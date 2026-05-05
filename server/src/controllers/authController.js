const User = require('../models/User');
const BadgeService = require('../services/badgeService');

class AuthController {
    async getCurrentUser(req, res) {
        if (!req.session.userId) {
            return res.json({ user: null });
        }

        try {
            const user = await User.findById(req.session.userId);
            res.json({ user });
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    getRegister(req, res) {
        res.render('pages/auth/register', {
            title: 'Register',
            errors: {},
            formData: {}
        });
    }

    async postRegister(req, res) {
        try {
            // Если есть ошибки валидации
            if (req.validationErrors) {
                return res.render('pages/auth/register', {
                    title: 'Register',
                    errors: req.validationErrors,
                    formData: req.validationData
                });
            }
            
            const { email, password, name, bio } = req.body;

            // Проверяем, не существует ли пользователь
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.render('pages/auth/register', {
                    title: 'Register',
                    errors: { general: ['User with this email already exists'] },
                    formData: req.body
                });
            }

            // Создаем пользователя
            const user = await User.create({
                email,
                password,
                name: name || email.split('@')[0],
                bio: bio || null
            });

            req.session.userId = user.id;
            req.session.userRole = user.role;

            let redirectTo = '/dashboard';
            if (user.role === 'admin') {
                redirectTo = '/admin';
            } else {
                redirectTo = req.session.returnTo || '/dashboard';
            }

            delete req.session.returnTo;

            res.redirect(redirectTo);

        } catch (error) {
            console.error('Registration error:', error);
            res.render('pages/auth/register', {
                title: 'Register',
                errors: { general: [error.message || 'Registration failed'] },
                formData: req.body
            });
        }
    }

    getLogin(req, res) {
        res.render('pages/auth/login', {
            title: 'Login',
            errors: {},
            formData: {}
        });
    }

    async postLogin(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findByEmail(email);
            
            if (!user) {
                return res.render('pages/auth/login', {
                    title: 'Login',
                    errors: { general: ['Invalid email or password'] },
                    formData: { email }
                });
            }

            const isValid = await User.validatePassword(user, password);
            
            if (!isValid) {
                return res.render('pages/auth/login', {
                    title: 'Login',
                    errors: { general: ['Invalid email or password'] },
                    formData: { email }
                });
            }

            req.session.userId = user.id;
            req.session.userRole = user.role;

            let redirectTo = '/dashboard';
            if (user.role === 'admin') {
                redirectTo = '/admin';
            } else {
                redirectTo = req.session.returnTo || '/dashboard';
            }

            delete req.session.returnTo;

            res.redirect(redirectTo);

        } catch (error) {
            console.error('Login error:', error);
            res.render('pages/auth/login', {
                title: 'Login',
                errors: { general: ['Login failed, please try again'] },
                formData: { email: req.body.email }
            });
        }
    }

    // Профиль пользователя
    async getProfile(req, res) {
        try {
            const user = await User.findById(req.session.userId);
            const userSkills = await User.getUserSkills(req.session.userId);
            const allSkills = await User.getAllSkills();
            const badges = await User.getUserBadges(req.session.userId);
            const stats = await User.getUserStats(req.session.userId);

            const userSkillIds = userSkills.map(skill => skill.id);
            const availableSkills = allSkills.filter(skill => !userSkillIds.includes(skill.id));
            
            res.render('pages/profile', {
                title: 'My Profile',
                user,
                skills: userSkills,
                allSkills: availableSkills,
                badges,
                stats,
                success: req.query.success,
                error: req.query.error,
            });
        } catch (error) {
            console.error('Profile error:', error);
            res.redirect('/dashboard');
        }
    }

    // Обновление профиля
    async updateProfile(req, res) {
        try {
            const { email, name, bio, currentPassword, newPassword, confirmPassword } = req.body;
            const userId = req.session.userId;
            
            const user = await User.findById(userId);
            if (!user) {
                return res.redirect('/auth/profile?error=User not found');
            }
            
            // Базовые поля для обновления
            const updateData = {};
            
            if (name !== undefined) updateData.name = name || null;
            if (bio !== undefined) updateData.bio = bio || null;
            
            // Обновляем email (с проверкой уникальности)
            if (email && email !== user.email) {
                const existingUser = await User.findByEmail(email);
                if (existingUser && existingUser.id !== userId) {
                    return res.redirect('/auth/profile?error=Email already exists');
                }
                updateData.email = email.toLowerCase();
            }
            
            // Проверяем, хочет ли пользователь сменить пароль
            if (currentPassword || newPassword || confirmPassword) {
            
                // 1. Проверяем, что все поля заполнены
                if (!currentPassword || !newPassword || !confirmPassword) {
                    return res.redirect('/auth/profile?error=All password fields are required to change password');
                }
                
                // 2. Проверяем, что текущий пароль правильный
                const isValid = await User.validatePassword(user, currentPassword);
                if (!isValid) {
                    return res.redirect('/auth/profile?error=Current password is incorrect');
                }
                
                // 3. Проверяем, что новый пароль и подтверждение совпадают
                if (newPassword !== confirmPassword) {
                    return res.redirect('/auth/profile?error=New passwords do not match');
                }
                
                updateData.password = newPassword;
            }
            
            await User.update(userId, updateData);
            
            res.redirect('/auth/profile?success=true');
            
        } catch (error) {
            console.error('Update profile error:', error);
            res.redirect('/auth/profile?error=' + encodeURIComponent(error.message));
        }
    }

    // Добавление навыка
    async addSkill(req, res) {
        try {
            const { skillTitle } = req.body;
            await User.addSkill(req.session.userId, skillTitle);
            await BadgeService.onUserAction(req.session.userId, 'skill_added');
            res.redirect('/auth/profile?success=true');
        } catch (error) {
            console.error('Add skill error:', error);
            res.redirect('/auth/profile?error=' + encodeURIComponent(error.message));
        }
    }

    // Удаление навыка
    async removeSkill(req, res) {
        try {
            const { skillTitle } = req.body;
            await User.removeSkill(req.session.userId, skillTitle);
            res.redirect('/auth/profile?success=true');
        } catch (error) {
            console.error('Remove skill error:', error);
            res.redirect('/auth/profile?error=true');
        }
    }

    async getBadges(req, res) {
        try {
            const badges = await User.getUserBadges(req.session.userId);
            res.json({ badges });
        } catch (error) {
            console.error('Get badges error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/');
        });
    }
}

module.exports = new AuthController();