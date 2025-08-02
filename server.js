const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createObjectCsvWriter } = require('csv-writer');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();

// --- DATABASE & DATA MANAGEMENT ---
const usersFilePath = path.join(__dirname, 'users.csv');
const dbFilePath = path.join(__dirname, 'db.json');
let users = [];
let db = { news: [], newsCategories: [] };
const continents = ['africa', 'asia', 'australia', 'europe', 'north-america', 'south-america'];
continents.forEach(continent => {
    db[continent] = { news: [], newsCategories: [] };
});

async function saveData() {
    try {
        await fs.promises.writeFile(dbFilePath, JSON.stringify(db, null, 2));
    } catch (error) { console.error('Error saving data:', error); }
}

async function loadData() {
    try {
        if (fs.existsSync(dbFilePath)) {
            const fileContent = await fs.promises.readFile(dbFilePath, 'utf8');
            const loadedDb = JSON.parse(fileContent);
            db = { ...db, ...loadedDb };
        }
        if (fs.existsSync(usersFilePath)) {
            const fileContent = fs.readFileSync(usersFilePath, 'utf8');
            if (fileContent.trim()) {
                users = parse(fileContent, { columns: true, skip_empty_lines: true });
            }
        }
    } catch (error) { console.error('Error loading data:', error); }
}

async function saveUsers() {
    const csvWriter = createObjectCsvWriter({
        path: usersFilePath,
        header: [
            { id: 'id', title: 'id' },
            { id: 'passwordHash', title: 'passwordHash' },
            { id: 'role', title: 'role' }
        ]
    });
    try {
        const records = users.map(({ id, passwordHash, role }) => ({ id, passwordHash, role }));
        await csvWriter.writeRecords(records);
    } catch (error) {
        console.error('Error saving users.csv:', error);
    }
}

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(session({
    secret: 'a-very-strong-secret-for-your-portal-continents',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const ensureAdmin = (requiredRole) => (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });
    const { role } = req.session.user;
    if (role === 'editor' || role === requiredRole) return next();
    res.status(403).json({ message: 'Forbidden' });
};

// --- API ROUTES ---
const apiRouter = express.Router();

// AUTH
apiRouter.post('/login/admin', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.id === username);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (isMatch) {
        req.session.user = { id: user.id, role: user.role };
        let redirectTo = user.role === 'editor' ? '/admin.html' : `/${user.role}/admin.html`;
        return res.json({ redirectTo });
    }
    res.status(401).json({ message: 'Invalid credentials' });
});
apiRouter.post('/logout', (req, res) => {
    let redirectTo = '/';
    if (req.session && req.session.user && req.session.user.role && continents.includes(req.session.user.role)) {
        redirectTo = `/${req.session.user.role}/`;
    }
    req.session.destroy(() => res.json({ redirectTo }));
});
// USER MANAGEMENT API
const mainAdminOnly = ensureAdmin('editor');
apiRouter.get('/users', mainAdminOnly, (req, res) => res.json(users.map(({ id, role }) => ({ id, role }))));
apiRouter.post('/users', mainAdminOnly, async (req, res) => {
    const { id, password, role } = req.body;
    if (!id || !password || !role) return res.status(400).json({ message: 'Missing required fields' });
    if (users.some(u => u.id === id)) return res.status(409).json({ message: 'User already exists' });
    users.push({ id, passwordHash: await bcrypt.hash(password, 10), role });
    await saveUsers();
    res.status(201).json({ id, role });
});
apiRouter.put('/users/:id', mainAdminOnly, async (req, res) => {
    const originalId = decodeURIComponent(req.params.id);
    const { id: newId, password, role } = req.body;
    const userIndex = users.findIndex(u => u.id === originalId);
    if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
    if (newId !== originalId && users.some(u => u.id === newId)) return res.status(409).json({ message: 'New user ID already in use' });
    const user = users[userIndex];
    user.id = newId || user.id;
    user.role = role || user.role;
    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    await saveUsers();
    res.json({ id: user.id, role: user.role });
});
apiRouter.delete('/users/:id', mainAdminOnly, async (req, res) => {
    const userId = decodeURIComponent(req.params.id);
    if (req.session.user.id === userId) return res.status(403).json({ message: 'Cannot delete your own account' });
    const initialLength = users.length;
    users = users.filter(u => u.id !== userId);
    if (users.length === initialLength) return res.status(404).json({ message: 'User not found' });
    await saveUsers();
    res.status(204).send();
});

// GENERAL (HOME PAGE) API
const generalAdminMiddleware = ensureAdmin('editor');
apiRouter.get('/news', (req, res) => res.json([...db.news].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))));
apiRouter.get('/news-categories', (req, res) => res.json(db.newsCategories));
apiRouter.post('/news', generalAdminMiddleware, async (req, res) => {
    const newEntry = { id: uuidv4(), ...req.body, timestamp: new Date().toISOString() };
    db.news.push(newEntry);
    await saveData();
    res.status(201).json(newEntry);
});
apiRouter.put('/news/:id', generalAdminMiddleware, async (req, res) => {
    const index = db.news.findIndex(n => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Not found' });
    db.news[index] = { ...db.news[index], ...req.body };
    await saveData();
    res.json(db.news[index]);
});
apiRouter.delete('/news/:id', generalAdminMiddleware, async (req, res) => {
    db.news = db.news.filter(n => n.id !== req.params.id);
    await saveData();
    res.status(204).send();
});
apiRouter.post('/news-categories', generalAdminMiddleware, async (req, res) => {
    const { category } = req.body;
    if (!category || db.newsCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    db.newsCategories.push(category);
    await saveData();
    res.status(201).json(db.newsCategories);
});
apiRouter.delete('/news-categories/:category', generalAdminMiddleware, async (req, res) => {
    const { category } = req.params;
    if (db.news.some(n => n.category === category)) return res.status(400).json({ message: 'Category is in use' });
    db.newsCategories = db.newsCategories.filter(c => c !== category);
    await saveData();
    res.status(204).send();
});

// DYNAMIC CONTINENT API ROUTES
continents.forEach(continent => {
    const adminMiddleware = ensureAdmin(continent);
    // GET
    apiRouter.get(`/${continent}/news`, (req, res) => res.json([...db[continent].news].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))));
    apiRouter.get(`/${continent}/news-categories`, (req, res) => res.json(db[continent].newsCategories));
    // POST NEWS
    apiRouter.post(`/${continent}/news`, adminMiddleware, async (req, res) => {
        const newEntry = { id: uuidv4(), ...req.body, timestamp: new Date().toISOString() };
        db[continent].news.push(newEntry);
        await saveData();
        res.status(201).json(newEntry);
    });
    // PUT NEWS
    apiRouter.put(`/${continent}/news/:id`, adminMiddleware, async (req, res) => {
        const index = db[continent].news.findIndex(n => n.id === req.params.id);
        if (index === -1) return res.status(404).json({ message: 'Not found' });
        db[continent].news[index] = { ...db[continent].news[index], ...req.body };
        await saveData();
        res.json(db[continent].news[index]);
    });
    // DELETE NEWS
    apiRouter.delete(`/${continent}/news/:id`, adminMiddleware, async (req, res) => {
        db[continent].news = db[continent].news.filter(n => n.id !== req.params.id);
        await saveData();
        res.status(204).send();
    });
    // POST CATEGORY
    apiRouter.post(`/${continent}/news-categories`, adminMiddleware, async (req, res) => {
        const { category } = req.body;
        if (!category || db[continent].newsCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });
        db[continent].newsCategories.push(category);
        await saveData();
        res.status(201).json(db[continent].newsCategories);
    });
    // DELETE CATEGORY
    apiRouter.delete(`/${continent}/news-categories/:category`, adminMiddleware, async (req, res) => {
        const { category } = req.params;
        if (db[continent].news.some(n => n.category === category)) return res.status(400).json({ message: 'Category is in use' });
        db[continent].newsCategories = db[continent].newsCategories.filter(c => c !== category);
        await saveData();
        res.status(204).send();
    });
});

// --- API ROUTER ---
app.use('/api', apiRouter);

// --- PAGE SERVING ---
// Admin pages (protected)
app.get('/admin.html', (req, res) => {
    if (req.session.user && req.session.user.role === 'editor') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/');
    }
});
app.get('/usermanagement.html', (req, res) => {
    if (req.session.user && req.session.user.role === 'editor') {
        res.sendFile(path.join(__dirname, 'public', 'usermanagement.html'));
    } else {
        res.status(403).send('<h1>403 Forbidden</h1>');
    }
});
continents.forEach(continent => {
    app.get(`/${continent}/admin.html`, (req, res) => {
        if (req.session.user && (req.session.user.role === continent || req.session.user.role === 'editor')) {
            res.sendFile(path.join(__dirname, 'public', continent, 'admin.html'));
        } else {
            res.status(403).send('<h1>403 Forbidden</h1>');
        }
    });
});

// --- SERVER STARTUP ---
const server = http.createServer(app);
const port = 3000;
server.listen(port, async () => {
    await loadData();
    console.log(`Server running at http://localhost:${port}`);
});