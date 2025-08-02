document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const newsGrid = document.getElementById('news-grid');
    const categoryBar = document.getElementById('category-bar');
    const pageTitle = document.querySelector('title');
    const continentName = document.body.dataset.continent;
    const newsModal = document.getElementById('news-modal');
    const modalCloseBtn = document.getElementById('news-modal-close');

    const skeletonLoaderHTML = Array(6).fill('<div class="skeleton-loader"></div>').join('');
    let allNews = []; // To store all fetched news
    let allCategories = []; // To store all categories

    // --- API HELPERS ---
    const api = {
        get: url => fetch(url).then(res => res.json().catch(() => ({})))
    };

    // --- RENDER FUNCTIONS ---
    const renderNews = (newsItems) => {
        if (!newsItems || newsItems.length === 0) {
            newsGrid.innerHTML = `<p>No news available for ${continentName}.</p>`;
            return;
        }
        newsGrid.innerHTML = newsItems.map(n => `
            <div class="news-card" data-id="${n.id}">
                <h3 class="news-card__heading">${n.heading}</h3>
                <p class="news-card__excerpt">${(n.content || '').substring(0, 150)}...</p>
                <p class="news-card__source">Source: ${n.source || 'N/A'}</p>
            </div>
        `).join('');
    };

    const renderCategories = (categories) => {
        allCategories = categories || [];
        if (allCategories.length === 0) {
            categoryBar.innerHTML = '<a>No Categories</a>';
            return;
        }
        categoryBar.innerHTML = `<a href="#" class="category-link active">All</a>` + allCategories.map(c => `<a href="#" class="category-link">${c}</a>`).join('');
    };

    // --- DATA FETCHING ---
    const fetchData = async () => {
        newsGrid.innerHTML = skeletonLoaderHTML;
        if (!continentName) {
            console.error("Continent name is not set in the body's data-continent attribute.");
            newsGrid.innerHTML = "<p>Error: Continent not configured for this page.</p>";
            return;
        }

        try {
            const [news, categories] = await Promise.all([
                api.get(`/api/${continentName}/news`),
                api.get(`/api/${continentName}/news-categories`)
            ]);
            allNews = news || [];
            renderNews(allNews);
            renderCategories(categories);
            const formattedName = continentName.charAt(0).toUpperCase() + continentName.slice(1).replace('-', ' ');
            pageTitle.textContent = `${formattedName} News - News Portal`;
        } catch (error) {
            console.error("Failed to fetch continent data:", error);
            newsGrid.innerHTML = `<p>Could not load news. Please try again later.</p>`;
        }
    };

    // --- EVENT HANDLERS ---
    const handleCategoryClick = (e) => {
        e.preventDefault();
        const clickedCategoryLink = e.target;

        if (!clickedCategoryLink.classList.contains('category-link')) return;

        document.querySelectorAll('.category-link').forEach(link => link.classList.remove('active'));
        clickedCategoryLink.classList.add('active');

        const selectedCategory = clickedCategoryLink.textContent;

        if (selectedCategory === 'All') {
            renderNews(allNews);
        } else {
            const filteredNews = allNews.filter(n => n.category === selectedCategory);
            renderNews(filteredNews);
        }
    };
    
    const openNewsModal = (newsId) => {
        const newsItem = allNews.find(n => n.id === newsId);
        if (!newsItem) return;
        
        document.getElementById('modal-heading').textContent = newsItem.heading;
        document.getElementById('modal-category').textContent = newsItem.category;
        document.getElementById('modal-timestamp').textContent = new Date(newsItem.timestamp).toLocaleString();
        document.getElementById('modal-body').innerHTML = (newsItem.content || '').replace(/\n/g, '<br>');
        document.getElementById('modal-source').textContent = `Source: ${newsItem.source}`;
        const link = document.getElementById('modal-link');
        if (newsItem.websiteLink) {
            link.href = newsItem.websiteLink;
            link.style.display = 'inline-block';
        } else {
            link.style.display = 'none';
        }
        newsModal.classList.add('show-modal');
    };

    // --- INITIALIZATION ---
    categoryBar.addEventListener('click', handleCategoryClick);
    newsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.news-card');
        if (card) openNewsModal(card.dataset.id);
    });
    modalCloseBtn.addEventListener('click', () => newsModal.classList.remove('show-modal'));

    fetchData();
});