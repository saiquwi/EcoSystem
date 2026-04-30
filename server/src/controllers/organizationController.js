const Organization = require('../models/Organization');
const OrganizationPost = require('../models/OrganizationPost');
const db = require('../../config/db');
const path = require('path');
const fs = require('fs');

class OrganizationController {
    // Страница организации
    async getOrganizationPage(req, res) {
        try {
            const { id } = req.params;
            console.log('Raw id from params:', id);
            console.log('Type:', typeof id);
            
            const orgId = parseInt(id);
            console.log('Parsed id:', orgId);
            const organization = await Organization.findById(parseInt(id));
            
            if (!organization) {
                return res.status(404).render('pages/404', { title: 'Organization Not Found' });
            }

            const referer = req.get('referer') || '';
            let returnTo = '/organizations/feed'; // по умолчанию на feed
            if (referer.includes('/my-organizations')) {
                returnTo = '/organizations/my-organizations';
            }
            
            // Получаем посты организации
            const posts = await OrganizationPost.findByOrganization(id);
            
            // Получаем ивенты организации
            const events = await db.query(`
                SELECT * FROM events 
                WHERE organization_id = $1 AND event_date >= CURRENT_DATE
                ORDER BY event_date ASC
                LIMIT 5
            `, [parseInt(id)]);
            
            // Проверяем, подписан ли пользователь
            let isFollowing = false;
            let isStaff = false;

            if (req.session.userId) {
                isFollowing = await Organization.isFollowing(id, req.session.userId);
            }

            const staffCheck = await db.query(`
                SELECT id FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2
            `, [id, req.session.userId]);
            isStaff = staffCheck.rows.length > 0;
            
            res.render('pages/organization', {
                title: organization.name,
                organization,
                posts,
                events: events.rows,
                isFollowing,
                isStaff: isStaff,
                returnTo,
                filter: req.query.filter || 'all'
            });
        } catch (error) {
            console.error('Organization page error:', error);
            res.redirect('/');
        }
    }
    
    // Новостная лента
    async getFeed(req, res) {
        try {
            const { filter = 'all', search = '', page = 1, q } = req.query;
            const limit = 20;
            const offset = (page - 1) * limit;
            
            let organizationIds = null;
            let organizations = [];
            let searchQuery = q || '';
            
            if (searchQuery) {
                organizations = await Organization.search(searchQuery, req.session.userId);
            }
            
            // Если фильтр "following" — показываем только посты организаций, на которые подписан пользователь
            if (filter === 'following' && req.session.userId) {
                const followedOrgs = await Organization.getFollowedOrganizations(req.session.userId);
                organizationIds = followedOrgs.map(org => org.id);

                // Если нет подписок — показываем пустой результат
                if (organizationIds.length === 0) {
                    return res.render('pages/feed', {
                        title: 'News Feed',
                        posts: [],
                        followingStatus: {},
                        filter,
                        search,
                        page,
                        hasMore: false
                    });
                }
            }
            
            const posts = await OrganizationPost.findAll({
                organizationIds,
                search: search || null,
                limit,
                offset
            });

            const userId = req.session.userId;
            let followingStatus = {};
            let isStaff = {};

            if (userId) {
                for (const post of posts) {
                    followingStatus[post.organization_id] = await Organization.isFollowing(
                        post.organization_id, 
                        userId
                    );

                    const staffCheck = await db.query(`
                        SELECT id FROM organizations_staff 
                        WHERE organization_id = $1 AND user_id = $2
                    `, [post.organization_id, userId]);
                    isStaff[post.id] = staffCheck.rows.length > 0;
                }
            }
            
            res.render('pages/feed', {
                title: 'News Feed',
                posts,
                followingStatus,
                isStaff: isStaff,
                filter,
                search,
                page,
                hasMore: posts.length === limit,
                organizations,
                searchQuery
            });
        } catch (error) {
            console.error('Feed error:', error);
            res.redirect('/');
        }
    }

    async searchOrganizations(req, res) {
        try {
            const { q } = req.query;
            
            if (!q || q.trim() === '') {
                return res.render('pages/organizations-search', {
                    title: 'Search Organizations',
                    organizations: [],
                    searchQuery: ''
                });
            }
            
            const organizations = await Organization.search(q, req.session.userId);
            
            res.render('pages/organizations-search', {
                title: `Search: ${q}`,
                organizations,
                searchQuery: q
            });
        } catch (error) {
            console.error('Search organizations error:', error);
            res.redirect('/');
        }
    }
    
    // API поиск организаций (для live search)
    async apiSearchOrganizations(req, res) {
        try {
            const { q } = req.query;
            
            if (!q || q.trim() === '') {
                return res.json([]);
            }
            
            const organizations = await Organization.search(q, req.session.userId);
            res.json(organizations);
        } catch (error) {
            console.error('API search organizations error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    // Подписаться/Отписаться (AJAX)
    async toggleFollow(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login to follow organizations' });
            }
            
            const isFollowing = await Organization.isFollowing(id, userId);
            
            if (isFollowing) {
                await Organization.unfollow(id, userId);
                res.json({ following: false, message: 'Unfollowed' });
            } else {
                await Organization.follow(id, userId);
                res.json({ following: true, message: 'Followed' });
            }
        } catch (error) {
            console.error('Toggle follow error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Мои организации (где пользователь имеет роль)
    async getMyOrganizations(req, res) {
        try {
            const userId = req.session.userId;
            
            if (!userId) {
                return res.redirect('/auth/login');
            }
            
            // Получаем организации, где пользователь имеет роль (moderator или owner)
            const query = `
                SELECT o.id, o.name, o.description, o.website, o.email, o.created_at,
                    os.position,
                    CASE WHEN os.position = 'owner' THEN true ELSE false END as is_owner
                FROM organizations o
                JOIN organizations_staff os ON o.id = os.organization_id
                WHERE os.user_id = $1
                ORDER BY os.position DESC, o.name ASC
            `;
            
            const result = await db.query(query, [userId]);
            const organizations = result.rows;
            
            // Статистика по ролям
            const stats = {
                owner: organizations.filter(org => org.position === 'owner').length,
                moderator: organizations.filter(org => org.position === 'moderator').length,
                total: organizations.length
            };
            
            res.render('pages/my-organizations', {
                title: 'My Organizations',
                organizations,
                stats,
                filter: req.query.filter || 'all'
            });
        } catch (error) {
            console.error('Get my organizations error:', error);
            res.redirect('/dashboard');
        }
    }

    // Получить запросы пользователя на создание организации
    async getUserOrganizationRequests(req, res) {
        try {
            const userId = req.session.userId;
            
            const requests = await db.query(`
                SELECT id, name, email, website, description, status, created_at
                FROM organization_creation_requests
                WHERE user_id = $1
                ORDER BY created_at DESC
            `, [userId]);
            
            res.json(requests.rows);
        } catch (error) {
            console.error('Get user organization requests error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Получить данные организации для редактирования
    async getOrganizationEditData(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            // Проверяем права пользователя
            const staffCheck = await db.query(`
                SELECT position FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2
            `, [id, userId]);
            
            if (staffCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            const isOwner = staffCheck.rows[0].position === 'owner';
            
            // Получаем данные организации
            const orgData = await Organization.findById(id);
            
            // Получаем модераторов (только для владельца)
            let moderators = [];
            if (isOwner) {
                const mods = await db.query(`
                    SELECT u.id, u.name, u.email
                    FROM organizations_staff os
                    JOIN users u ON os.user_id = u.id
                    WHERE os.organization_id = $1 AND os.position = 'moderator'
                `, [id]);
                moderators = mods.rows;
            }
            
            res.json({
                ...orgData,
                moderators,
                isOwner
            });
        } catch (error) {
            console.error('Get organization edit data error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Обновить организацию
    async updateOrganizationData(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            const { name, email, website, description } = req.body;
            
            // Проверяем права
            const staffCheck = await db.query(`
                SELECT position FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2
            `, [id, userId]);
            
            if (staffCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            const isOwner = staffCheck.rows[0].position === 'owner';
            
            // Формируем запрос в зависимости от прав
            let query;
            let values;
            
            if (isOwner) {
                query = `
                    UPDATE organizations 
                    SET name = $1, email = $2, website = $3, description = $4
                    WHERE id = $5
                    RETURNING id
                `;
                values = [name, email, website || null, description || null, id];
            } else {
                query = `
                    UPDATE organizations 
                    SET description = $1
                    WHERE id = $2
                    RETURNING id
                `;
                values = [description || null, id];
            }
            
            await db.query(query, values);
            res.json({ success: true });
        } catch (error) {
            console.error('Update organization error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Добавить модератора
    async addModerator(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.body;
            const currentUserId = req.session.userId;
            
            // Проверяем, что текущий пользователь - владелец
            const ownerCheck = await db.query(`
                SELECT id FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2 AND position = 'owner'
            `, [id, currentUserId]);
            
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Only owner can add moderators' });
            }
            
            // Добавляем модератора
            await db.query(`
                INSERT INTO organizations_staff (organization_id, user_id, position)
                VALUES ($1, $2, 'moderator')
                ON CONFLICT (organization_id, user_id) DO NOTHING
            `, [id, userId]);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Add moderator error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Удалить модератора
    async removeModerator(req, res) {
        try {
            const { id, userId } = req.params;
            const currentUserId = req.session.userId;
            
            // Проверяем, что текущий пользователь - владелец
            const ownerCheck = await db.query(`
                SELECT id FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2 AND position = 'owner'
            `, [id, currentUserId]);
            
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Only owner can remove moderators' });
            }
            
            await db.query(`
                DELETE FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2 AND position = 'moderator'
            `, [id, userId]);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Remove moderator error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Получить доступных пользователей для назначения модератором
    async getAvailableUsers(req, res) {
        try {
            const { id } = req.params;
            
            const users = await db.query(`
                SELECT u.id, u.name, u.email
                FROM users u
                WHERE u.role = 'volunteer'
                AND NOT EXISTS (
                    SELECT 1 FROM organizations_staff 
                    WHERE organization_id = $1 AND user_id = u.id
                )
                ORDER BY u.name
            `, [id]);
            
            res.json(users.rows);
        } catch (error) {
            console.error('Get available users error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Создание заявки на организацию
    async createOrganizationRequest(req, res) {
        try {
            const { name, email, website, description } = req.body;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login' });
            }

            // Проверяем, не существует ли уже организация с таким email
            const existingOrg = await db.query(`
                SELECT id FROM organizations WHERE email = $1
            `, [email]);
            
            if (existingOrg.rows.length > 0) {
                return res.status(400).json({ error: 'Organization with this email already exists' });
            }
            
            // Создаем заявку
            await db.query(`
                INSERT INTO organization_creation_requests (user_id, name, email, website, description)
                VALUES ($1, $2, $3, $4, $5)
            `, [userId, name, email, website || null, description || null]);
            
            res.status(201).json({ success: true, message: 'Request sent successfully. Admin will review it.' });
        } catch (error) {
            console.error('Create organization request error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Создать пост
    async createPost(req, res) {
        try {
            const { organizationId, content } = req.body;
            const userId = req.session.userId;
            
            // Проверяем права
            const staffCheck = await db.query(`
                SELECT id FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2
            `, [organizationId, userId]);
            
            if (staffCheck.rows.length === 0) {
                return res.status(403).json({ error: 'You do not have permission to create posts for this organization' });
            }

            // Проверяем, есть ли ошибка multer в req.fileValidationError
            if (req.fileValidationError) {
                return res.status(400).json({ error: req.fileValidationError });
            }

            if (req.files && req.files.length > 5) {
                return res.status(400).json({ error: 'Maximum 5 photos allowed per post' });
            }
            
            const photos = req.files ? req.files.map(file => `/uploads/posts/${file.filename}`) : [];
            
            const post = await OrganizationPost.create({
                organizationId,
                content,
                photos
            });
            
            res.status(201).json({ success: true, post });
        } catch (error) {
            console.error('Create post error:', error);

            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Each photo must be less than 5MB' });
            }
            if (error.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ error: 'Maximum 5 photos allowed per post' });
            }
            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ error: 'Unexpected field name for photos' });
            }
            
            res.status(500).json({ error: error.message });
        }
    }

    // Обновить пост
    async updatePost(req, res) {
        try {
            const { id } = req.params;
            const { content, photosToKeep } = req.body;
            const userId = req.session.userId;
            
            // Получаем пост
            const post = await OrganizationPost.findById(id);
            if (!post) {
                return res.status(404).json({ error: 'Post not found' });
            }
            
            // Проверяем права
            const staffCheck = await db.query(`
                SELECT id FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2
            `, [post.organization_id, userId]);
            
            if (staffCheck.rows.length === 0) {
                return res.status(403).json({ error: 'You do not have permission to edit this post' });
            }
            
            // Обрабатываем новые фото
            const newPhotos = req.files ? req.files.map(file => `/uploads/posts/${file.filename}`) : [];
            
            let photosToKeepArray = [];
            if (photosToKeep) {
                try {
                    photosToKeepArray = typeof photosToKeep === 'string' 
                        ? JSON.parse(photosToKeep) 
                        : photosToKeep;
                } catch(e) {
                    console.error('Failed to parse photosToKeep:', e);
                }
            }
            const currentPhotos = post.photos || [];
            const photosToRemove = currentPhotos.filter(p => !photosToKeepArray.includes(p));
            photosToRemove.forEach(photoPath => {
                const fullPath = path.join(__dirname, '../../public', photoPath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            });
            const allPhotos = [...photosToKeepArray, ...newPhotos];
            
            await OrganizationPost.update(id, { content, photos: allPhotos });
            
            res.json({ success: true });
        } catch (error) {
            console.error('Update post error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Удалить пост
    async deletePost(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            // Получаем пост
            const post = await OrganizationPost.findById(id);
            if (!post) {
                return res.status(404).json({ error: 'Post not found' });
            }

            const staffCheck = await db.query(`
                SELECT id, position FROM organizations_staff 
                WHERE organization_id = $1 AND user_id = $2
            `, [post.organization_id, userId]);

            if (staffCheck.rows.length === 0) {
                return res.status(403).json({ error: 'You do not have permission to delete this post' });
            }
            
            // Удаляем фото с диска
            if (post.photos && post.photos.length > 0) {
                post.photos.forEach(photoPath => {
                    const fullPath = path.join(__dirname, '../../public', photoPath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                });
            }
            
            await OrganizationPost.delete(id, post.organization_id, userId);
            res.json({ success: true });
        } catch (error) {
            console.error('Delete post error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Получить посты организации (для страницы организации)
    async getOrganizationPosts(req, res) {
        try {
            const { id } = req.params;
            const { limit = 10, offset = 0 } = req.query;
            
            const posts = await OrganizationPost.findByOrganization(id, parseInt(limit), parseInt(offset));
            res.json(posts);
        } catch (error) {
            console.error('Get organization posts error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new OrganizationController();