document.addEventListener('DOMContentLoaded', () => {
    const userForm = document.getElementById('user-form');
    const originalUserIdInput = document.getElementById('original-user-id');
    const userIdInput = document.getElementById('user-id-input');
    const userPasswordInput = document.getElementById('user-password-input');
    const userRoleSelect = document.getElementById('user-role-select');
    const userList = document.getElementById('user-list');
    const formTitle = document.getElementById('user-form-title');
    const clearFormBtn = document.getElementById('clear-user-form-btn');

    let allUsers = [];

    const api = {
        get: url => fetch(url).then(res => {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        }),
        post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        delete: url => fetch(url, { method: 'DELETE' })
    };

    const renderUsers = () => {
        userList.innerHTML = allUsers.map(user => `
            <div class="user-list-item">
                <div class="user-details">
                    <span class="user-id">${user.id}</span>
                    <span class="user-role">${user.role.replace('-', ' ')}</span>
                </div>
                <div class="list-item-actions">
                    <button class="btn-edit" data-id="${user.id}"><i class="ri-pencil-line"></i></button>
                    <button class="btn-delete" data-id="${user.id}"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>
        `).join('');
    };

    const fetchUsers = async () => {
        try {
            allUsers = await api.get('/api/users');
            renderUsers();
        } catch (error) {
            console.error("Failed to fetch users:", error);
            alert('You do not have permission to manage users or the server is down.');
            window.location.href = '/admin.html';
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const originalId = originalUserIdInput.value;
        const userData = {
            id: userIdInput.value,
            password: userPasswordInput.value,
            role: userRoleSelect.value
        };

        if (originalId && !userData.password) {
            delete userData.password;
        }

        try {
            let response;
            if (originalId) {
                response = await api.put(`/api/users/${encodeURIComponent(originalId)}`, userData);
            } else {
                response = await api.post('/api/users', userData);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'An error occurred.');
            }

            resetForm();
            fetchUsers();

        } catch (error) {
            alert(`Error saving user: ${error.message}`);
        }
    };

    const handleUserListClick = (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');

        if (editBtn) {
            const userId = editBtn.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                formTitle.textContent = 'Edit User';
                originalUserIdInput.value = user.id;
                userIdInput.value = user.id;
                userRoleSelect.value = user.role;
                userPasswordInput.value = '';
                userPasswordInput.placeholder = "Password (leave blank to keep unchanged)";
                window.scrollTo(0, 0);
            }
        }

        if (deleteBtn) {
            const userId = deleteBtn.dataset.id;
            if (confirm(`Are you sure you want to delete the user "${userId}"? This cannot be undone.`)) {
                deleteUser(userId);
            }
        }
    };

    const deleteUser = async (userId) => {
        try {
            const response = await api.delete(`/api/users/${encodeURIComponent(userId)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete user.');
            }
            fetchUsers();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    const resetForm = () => {
        userForm.reset();
        originalUserIdInput.value = '';
        formTitle.textContent = 'Add New User';
        userPasswordInput.placeholder = "Password";
    };

    userForm.addEventListener('submit', handleFormSubmit);
    userList.addEventListener('click', handleUserListClick);
    clearFormBtn.addEventListener('click', resetForm);

    fetchUsers();
});