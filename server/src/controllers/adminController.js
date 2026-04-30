const User = require('../models/User');
const Problem = require('../models/Problem');
const Organization = require('../models/Organization');
const db = require('../../config/db');

class AdminController {
    async getPanel(req, res) {
        try {
            // Статистика пользователей
            const userStats = await User.getStats();
            
            // Статистика по проблемам
            const problemStatsResult = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
                    COALESCE(AVG(severity)::numeric, 0) as avg_severity
                FROM problems
                WHERE status != 'deleted'
            `);
            const problemStats = {
                total: parseInt(problemStatsResult.rows[0].total),
                pending: parseInt(problemStatsResult.rows[0].pending),
                confirmed: parseInt(problemStatsResult.rows[0].confirmed),
                in_progress: parseInt(problemStatsResult.rows[0].in_progress),
                completed: parseInt(problemStatsResult.rows[0].completed),
                closed: parseInt(problemStatsResult.rows[0].closed),
                avg_severity: parseFloat(problemStatsResult.rows[0].avg_severity) || 0
            };
            
            const orgStatsResult = await db.query(`
                SELECT COUNT(*) as total
                FROM organizations
            `);
            const organizationStats = orgStatsResult.rows[0];

            // Статистика по заявкам на создание организаций
            const pendingRequestsResult = await db.query(`
                SELECT COUNT(*) as count
                FROM organization_creation_requests
                WHERE status = 'pending'
            `);
            const pendingRequests = pendingRequestsResult.rows[0].count;
            
            // Последние пользователи
            const recentUsers = await User.findAll({ limit: 5 });
            
            // Последние проблемы
            const recentProblems = await Problem.findAll({ limit: 5 });

            // Последние организации
            const recentOrganizations = await Organization.getRecent(5);

            const recentRequests = await db.query(`
                SELECT r.id, r.name, r.status, r.created_at,
                    u.name as user_name, u.email as user_email
                FROM organization_creation_requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC
                LIMIT 5
            `);
            
            res.render('pages/admin/panel', {
                title: 'Admin Panel',
                userStats,
                problemStats,
                organizationStats,
                pendingRequests,
                recentUsers,
                recentProblems,
                recentOrganizations,
                recentRequests: recentRequests.rows
            });
        } catch (error) {
            console.error('Admin panel error:', error);
            res.redirect('/dashboard');
        }
    }
    
    // Управление пользователями
    async getUsers(req, res) {
        try {
            const users = await User.findAll();

            res.render('pages/admin/users', {
                title: 'Manage Users',
                users,
                formData: {},
                errors: {},
                success: req.query.success,
                showModal: false
            });
        } catch (error) {
            console.error('Admin users error:', error);
            res.redirect('/admin');
        }
    }

    // Создание нового пользователя (админом)
    async createUser(req, res) {
        try {
            // Если есть ошибки валидации
            if (req.validationErrors) {
                const users = await User.findAll();
                return res.render('pages/admin/users', {
                    title: 'Manage Users',
                    users,
                    formData: req.validationData,
                    errors: req.validationErrors,
                    success: null,
                    showModal: true
                });
            }
            const { email, password, name, role, bio } = req.body;
            
            // Проверяем, не существует ли пользователь
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                // Рендерим страницу с ошибкой
                const users = await User.findAll();
                return res.render('pages/admin/users', {
                    title: 'Manage Users',
                    users,
                    formData: req.body,
                    errors: { general: ['User with this email already exists'] },
                    success: null,
                    showModal: true
                });
            }
            
            // Создаем пользователя
            await User.create({
                email,
                password,
                name: name || email.split('@')[0],
                role,
                bio: bio || null
            });
            
            // Успех — редирект
            res.redirect('/admin/users?success=true');
            
        } catch (error) {
            console.error('Create user error:', error);
            
            const users = await User.findAll();
            res.render('pages/admin/users', {
                title: 'Manage Users',
                users,
                formData: req.body,
                errors: { general: [error.message || 'Failed to create user'] },
                success: null
            });
        }
    }
    
    // Удаление пользователя
    async deleteUser(req, res) {
        try {
            const { userId } = req.params;
            const adminId = req.session.userId;
            
            if (parseInt(userId) === adminId) {
                return res.status(400).json({ error: 'Cannot delete yourself' });
            }
            
            await User.delete(userId);
            res.json({ success: true });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    // Управление проблемами
    async getProblems(req, res) {
        try {
            const { category, status } = req.query;
            const problems = await Problem.findAll({ category, status });
            
            // Получаем все категории для фильтра
            const categories = await Problem.getAllCategories();
            
            res.render('pages/admin/problems', {
                title: 'Manage Problems',
                problems,
                categories,
                currentCategory: category || 'all',
                currentStatus: status || 'all',
                success: req.query.success,
                currentPage: 'admin-problems'
            });
        } catch (error) {
            console.error('Admin problems error:', error);
            res.redirect('/admin');
        }
    }
    
    // Удаление проблемы (админ)
    async deleteProblem(req, res) {
        try {
            const { problemId } = req.params;
            await db.query('DELETE FROM problems WHERE id = $1', [problemId]);
            res.json({ success: true });
        } catch (error) {
            console.error('Delete problem error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Управление организациями
    async getOrganizations(req, res) {
        try {
            const { search } = req.query;
            const organizations = await Organization.findAll({ search });

            // Получаем всех пользователей для выбора владельца
            const users = await User.findAll();
            
            res.render('pages/admin/organizations', {
                title: 'Manage Organizations',
                organizations,
                users,
                formData: {},
                errors: {},
                success: req.query.success,
                showModal: false
            });
        } catch (error) {
            console.error('Admin organizations error:', error);
            res.redirect('/admin');
        }
    }

    // Получить организацию для редактирования (AJAX)
    async getOrganization(req, res) {
        try {
            const { organizationId } = req.params;
            const organization = await Organization.findById(organizationId);
            
            if (!organization) {
                return res.status(404).json({ error: 'Organization not found' });
            }

            // Получаем всех владельцев
            const ownersResult = await db.query(`
                SELECT u.id, u.name, u.email
                FROM organizations_staff os
                JOIN users u ON os.user_id = u.id
                WHERE os.organization_id = $1 AND os.position = 'owner'
            `, [organizationId]);
            
            organization.owners = ownersResult.rows;
            
            res.json(organization);
        } catch (error) {
            console.error('Get organization error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Создание организации
    async createOrganization(req, res) {
        console.log('🔴 createOrganization called');
        try {
            if (req.validationErrors) {
                const organizations = await Organization.findAll();
                const users = await User.findAll();
                return res.render('pages/admin/organizations', {
                    title: 'Manage Organizations',
                    organizations,
                    users,
                    formData: req.validationData,
                    errors: req.validationErrors,
                    success: null,
                    showModal: true
                });
            }
            
            const { name, description, website, email, ownersIds } = req.body;
            
            const existing = await db.query('SELECT id FROM organizations WHERE email = $1', [email]);
            if (existing.rows.length > 0) {
                const organizations = await Organization.findAll();
                const users = await User.findAll();
                return res.render('pages/admin/organizations', {
                    title: 'Manage Organizations',
                    organizations,
                    users,
                    formData: req.body,
                    errors: { general: ['Organization with this email already exists'] },
                    success: null,
                    showModal: true
                });
            }
            
            // Создаем организацию
            const organization = await Organization.create({
                name,
                description,
                website,
                email
            });

            // Добавляем владельцев
            const ownerIdsArray = ownersIds ? (Array.isArray(ownersIds) ? ownersIds : ownersIds.split(',').map(Number)) : [];
            for (const ownerId of ownerIdsArray) {
                if (ownerId) {
                    await db.query(`
                        INSERT INTO organizations_staff (organization_id, user_id, position)
                        VALUES ($1, $2, 'owner')
                    `, [organization.id, ownerId]);
                }
            }
            
            res.redirect('/admin/organizations?success=true&t=' + Date.now());
            
        } catch (error) {
            console.error('Create organization error:', error);
            const organizations = await Organization.findAll();
            const users = await User.findAll();
            res.render('pages/admin/organizations', {
                title: 'Manage Organizations',
                organizations,
                users,
                formData: req.body,
                errors: { general: [error.message || 'Failed to create organization'] },
                success: null,
                showModal: true
            });
        }
    }

    // Обновить организацию
    async updateOrganization(req, res) {
        console.log('🟢 updateOrganization called, id:', req.params.organizationId);
        try {
            const { organizationId } = req.params;
            if (!organizationId) {
                return this.createOrganization(req, res);
            }

            // Если есть ошибки валидации
            if (req.validationErrors) {
                const organizations = await Organization.findAll();
                const users = await User.findAll();
                return res.render('pages/admin/organizations', {
                    title: 'Manage Organizations',
                    organizations,
                    users,
                    formData: req.validationData,
                    errors: req.validationErrors,
                    success: null,
                    showModal: true
                });
            }

            const { name, description, website, email, ownersIds } = req.body;
            
            // Проверяем, существует ли организация с таким email (кроме текущей)
            const existing = await db.query(
                'SELECT id FROM organizations WHERE email = $1 AND id != $2',
                [email, organizationId]
            );
            if (existing.rows.length > 0) {
                const organizations = await Organization.findAll();
                const users = await User.findAll();
                return res.render('pages/admin/organizations', {
                    title: 'Manage Organizations',
                    organizations,
                    users,
                    formData: req.body,
                    errors: { email: ['Organization with this email already exists'] },
                    success: null,
                    showModal: true
                });
            }
            
            await Organization.update(organizationId, {
                name,
                description,
                website,
                email
            });

            // Обновляем владельцев
            const newOwnerIds = ownersIds ? (Array.isArray(ownersIds) ? ownersIds : ownersIds.split(',').map(Number)) : [];
            
            // Получаем текущих владельцев
            const currentOwners = await db.query(`
                SELECT user_id FROM organizations_staff 
                WHERE organization_id = $1 AND position = 'owner'
            `, [organizationId]);
            const currentOwnerIds = currentOwners.rows.map(r => r.user_id);

            // Находим владельцев для удаления (были, но не в новых)
            const toRemove = currentOwnerIds.filter(id => !newOwnerIds.includes(id));

            // Находим владельцев для добавления (новые, но не были)
            const toAdd = newOwnerIds.filter(id => !currentOwnerIds.includes(id));

            // Удаляем
            for (const ownerId of toRemove) {
                await db.query(`
                    DELETE FROM organizations_staff 
                    WHERE organization_id = $1 AND user_id = $2 AND position = 'owner'
                `, [organizationId, ownerId]);
            }
            
            // Добавляем
            for (const ownerId of toAdd) {
                if (ownerId) {
                    await db.query(`
                        INSERT INTO organizations_staff (organization_id, user_id, position)
                        VALUES ($1, $2, 'owner')
                    `, [organizationId, ownerId]);
                }
            }

            res.redirect('/admin/organizations?success=true&t=' + Date.now());
        } catch (error) {
            console.error('Update organization error:', error);
            const organizations = await Organization.findAll();
            const users = await User.findAll();
            res.render('pages/admin/organizations', {
                title: 'Manage Organizations',
                organizations,
                users,
                formData: req.body,
                errors: { general: [error.message || 'Failed to update organization'] },
                success: null,
                showModal: true
            });
        }
    }

    // Удаление организации
    async deleteOrganization(req, res) {
        try {
            const { organizationId } = req.params;
            await Organization.delete(organizationId);
            res.json({ success: true, message: 'Organization deleted successfully' });
        } catch (error) {
            console.error('Delete organization error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Получить скиллы пользователя (только просмотр)
    async getUserSkills(req, res) {
        try {
            const { userId } = req.params;
            const skills = await User.getUserSkills(userId);
            res.json({ skills });
        } catch (error) {
            console.error('Get user skills error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Получить бейджи пользователя (только просмотр)
    async getUserBadges(req, res) {
        try {
            const { userId } = req.params;
            const badges = await User.getUserBadges(userId);
            res.json({ badges });
        } catch (error) {
            console.error('Get user badges error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Получить все заявки на создание организаций (админ)
    async getOrganizationRequests(req, res) {
        try {
            const requests = await db.query(`
                SELECT r.*, u.name as user_name, u.email as user_email
                FROM organization_creation_requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC
            `);
            
            res.render('pages/admin/organization-requests', {
                title: 'Organization Requests',
                requests: requests.rows
            });
        } catch (error) {
            console.error('Get organization requests error:', error);
            res.redirect('/admin');
        }
    }

    // Принять заявку (создать организацию)
    async approveOrganizationRequest(req, res) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const { requestId } = req.params;
            
            // Получаем данные заявки
            const requestResult = await client.query(`
                SELECT * FROM organization_creation_requests WHERE id = $1
            `, [requestId]);
            
            if (requestResult.rows.length === 0) {
                return res.status(404).json({ error: 'Request not found' });
            }
            
            const request = requestResult.rows[0];
            
            // Создаем организацию
            const orgResult = await client.query(`
                INSERT INTO organizations (name, description, website, email)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [request.name, request.description, request.website, request.email]);
            
            const organizationId = orgResult.rows[0].id;
            
            // Назначаем пользователя владельцем
            await client.query(`
                INSERT INTO organizations_staff (organization_id, user_id, position)
                VALUES ($1, $2, 'owner')
            `, [organizationId, request.user_id]);
            
            // Удаляем заявку
            await client.query('DELETE FROM organization_creation_requests WHERE id = $1', [requestId]);
            
            await client.query('COMMIT');
            res.json({ success: true, message: 'Organization created successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Approve organization request error:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    // Отклонить заявку
    async rejectOrganizationRequest(req, res) {
        try {
            const { requestId } = req.params;
            
            await db.query(`
                UPDATE organization_creation_requests 
                SET status = 'rejected'
                WHERE id = $1
            `, [requestId]);
            
            res.json({ success: true, message: 'Request rejected' });
        } catch (error) {
            console.error('Reject organization request error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AdminController();