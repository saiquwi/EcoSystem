const Problem = require('../models/Problem');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const BadgeService = require('../services/badgeService');

class ProblemController {
    // GET /problems - получить все проблемы
    async getAll(req, res) {
        try {
            const { category, status } = req.query;
            const problems = await Problem.findAll({ category, status });
            res.json(problems);
        } catch (error) {
            console.error('Error fetching problems:', error);
            res.status(500).json({ error: 'Failed to fetch problems' });
        }
    }

    // GET /problems/:id - получить одну проблему
    async getOne(req, res) {
        try {
            const { id } = req.params;
            const problem = await Problem.findById(id);
            
            if (!problem) {
                return res.status(404).json({ error: 'Problem not found' });
            }
            
            // Добавляем список подтверждений
            const confirmations = await Problem.getConfirmations(id);
            problem.confirmations_list = confirmations;

            // Добавляем фото (если есть)
            if (problem.photos) {
                problem.photos_list = problem.photos; // уже массив
            } else {
                problem.photos_list = [];
            }
            
            // Добавляем имя назначенного пользователя
            if (problem.assigned_to_user) {
                const User = require('../models/User');
                const assignedUser = await User.findById(problem.assigned_to_user);
                problem.assigned_to_name = assignedUser ? assignedUser.name : 'Unknown';
            }
            
            const userId = req.session.userId;
            problem.current_user = {
                isAuthenticated: !!userId,
                isAuthor: userId && problem.created_by === userId,
                isAssigned: userId && problem.assigned_to_user === userId,
                hasConfirmed: false,
                hasConfirmedResolution: false
            };
            
            // Проверял ли пользователь эту проблему
            if (userId) {
                const db = require('../../config/db');
                const confirmResult = await db.query(
                    'SELECT id FROM problem_confirmations WHERE problem_id = $1 AND user_id = $2',
                    [id, userId]
                );
                problem.current_user.hasConfirmed = confirmResult.rows.length > 0;
                
                const resolutionResult = await db.query(
                    'SELECT id FROM problem_resolution_confirmations WHERE problem_id = $1 AND user_id = $2',
                    [id, userId]
                );
                problem.current_user.hasConfirmedResolution = resolutionResult.rows.length > 0;
            }
            
            res.json(problem);
        } catch (error) {
            console.error('Error fetching problem:', error);
            res.status(500).json({ error: 'Failed to fetch problem' });
        }
    }

    // POST /problems - создать новую проблему
    async create(req, res) {
        try {
            const { title, description, category, severity, latitude, longitude } = req.body;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login to report a problem' });
            }
            
            if (!title || !category || !latitude || !longitude) {
                return res.status(400).json({ error: 'Title, category, and location are required' });
            }
            
            // Обрабатываем загруженные фото
            const photos = req.files ? req.files.map(file => {
                return `/uploads/problems/${file.filename}`;
            }) : [];
            
            const problem = await Problem.create({
                title,
                description,
                category,
                severity,
                latitude,
                longitude,
                userId,
                photos  
            });

            await BadgeService.onUserAction(userId, 'problem_reported');
            
            res.status(201).json({ 
                id: problem.id, 
                message: 'Problem reported successfully',
                photos: photos
            });
        } catch (error) {
            console.error('Error creating problem:', error);
            res.status(500).json({ error: error.message || 'Failed to create problem' });
        }
    }

    // POST /problems/:id/confirm - подтвердить проблему
    async confirm(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login to confirm' });
            }

            const problem = await Problem.findById(id);
            if (!problem) {
                return res.status(404).json({ error: 'Problem not found' });
            }
            
            if (problem.created_by === userId) {
                return res.status(403).json({ error: 'You cannot confirm your own problem' });
            }
            
            const result = await Problem.confirm(id, userId);
            await BadgeService.onUserAction(userId, 'problem_confirmed');
            res.json({ message: 'Problem confirmed successfully', status: result.status });
        } catch (error) {
            console.error('Error confirming problem:', error);
            res.status(500).json({ error: error.message || 'Failed to confirm problem' });
        }
    }

    // POST /problems/:id/take - взять проблему в работу
    async take(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login to take problem' });
            }
            
            await Problem.take(id, userId);
            res.json({ message: 'Problem taken successfully' });
        } catch (error) {
            console.error('Error taking problem:', error);
            res.status(500).json({ error: error.message || 'Failed to take problem' });
        }
    }

    // POST /problems/:id/complete - завершить проблему
    async complete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login' });
            }
            
            await Problem.complete(id, userId);
            res.json({ message: 'Problem completed successfully' });
        } catch (error) {
            console.error('Error completing problem:', error);
            res.status(500).json({ error: error.message || 'Failed to complete problem' });
        }
    }

    // POST /problems/:id/confirm-resolution - подтвердить решение
    async confirmResolution(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login' });
            }
            
            const result = await Problem.confirmResolution(id, userId);
            res.json({ message: 'Resolution confirmed successfully', status: result.status });
        } catch (error) {
            console.error('Error confirming resolution:', error);
            res.status(500).json({ error: error.message || 'Failed to confirm resolution' });
        }
    }

    // DELETE /problems/:id - удалить проблему
    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ error: 'Please login to delete problem' });
            }
            
            await Problem.delete(id, userId);
            res.json({ message: 'Problem deleted successfully' });
        } catch (error) {
            console.error('Error deleting problem:', error);
            res.status(500).json({ error: error.message || 'Failed to delete problem' });
        }
    }
}

module.exports = new ProblemController();