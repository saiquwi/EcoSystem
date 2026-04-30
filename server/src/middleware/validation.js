const validator = require('validator');
const xss = require('xss');
const escapeHtml = require('escape-html');
const User = require('../models/User');

const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    // Удаляем потенциально опасные теги и атрибуты
    return xss(input.trim());
};

const sanitizeEmail = (email) => {
    if (!email) return '';
    return validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_lowercase: true,
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_lowercase: true,
        yandex_lowercase: true,
        icloud_lowercase: true
    });
};

const validateEmail = (email) => {
    const errors = [];
    
    if (!email || email.trim() === '') {
        errors.push('Email is required');
        return { isValid: false, errors };
    }
    
    const sanitized = sanitizeEmail(email);
    
    // Проверка на допустимые символы (только латиница, цифры, @, ., -, _)
    const emailRegex = /^[a-zA-Z0-9@._\-]+$/;
    if (!emailRegex.test(sanitized)) {
        errors.push('Email can only contain Latin letters, numbers, and characters: @ . _ -');
    }
    
    // Проверка формата email
    if (!validator.isEmail(sanitized)) {
        errors.push('Please enter a valid email address');
    }
    
    // Проверка на длину
    if (sanitized.length > 70) {
        errors.push('Email must not exceed 70 characters');
    }
    
    // Проверка на опасные паттерны (SQL injection, XSS)
    const dangerousPatterns = [
        /<script/i, /javascript:/i, /onload=/i, /onerror=/i,
        /SELECT.*FROM/i, /INSERT.*INTO/i, /DELETE.*FROM/i, /DROP.*TABLE/i,
        /--/, /;/, /\|\|/, /&&/
    ];
    
    for (const pattern of dangerousPatterns) {
        if (pattern.test(sanitized)) {
            errors.push('Email contains invalid characters');
            break;
        }
    }
    
    return {
        isValid: errors.length === 0,
        sanitized,
        errors
    };
};

const validatePassword = (password) => {
    const errors = [];
    
    if (!password) {
        errors.push('Password is required');
        return { isValid: false, errors };
    }
    
    // Минимальная и максимальная длина
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 70) {
        errors.push('Password must not exceed 70 characters');
    }
    
    // Должна быть хотя бы одна буква (латиница)
    if (!/[a-zA-Z]/.test(password)) {
        errors.push('Password must contain at least one letter');
    }
    
    // Должна быть хотя бы одна цифра
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    // Должен быть хотя бы один специальный символ
    if (!/[!@#$%^&*()_\-+=[\]{};:<>|./?~`]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

const validateName = (name) => {
    const errors = [];
    
    if (!name || name.trim() === '') {
        return { isValid: true, sanitized: null }; // имя необязательно
    }
    
    const sanitized = sanitizeInput(name);
    
    // Длина
    if (sanitized.length < 2) {
        errors.push('Name must be at least 2 characters long');
    }
    if (sanitized.length > 100) {
        errors.push('Name must not exceed 100 characters');
    }
    
    // Разрешаем: латиницу, кириллицу, иероглифы, пробелы, дефисы, апострофы
    // Используем Unicode категории: L (буквы), Zs (пробелы), P (пунктуация)
    const nameRegex = /^[\p{L}\s\-']+$/u;
    if (!nameRegex.test(sanitized)) {
        errors.push('Name can only contain letters, spaces, hyphens, and apostrophes');
    }
    
    // Проверка на слишком много пробелов подряд
    if (/\s{2,}/.test(sanitized)) {
        errors.push('Name cannot contain 2 or more spaces in a row');
    }
    
    // Проверка на эмодзи
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(sanitized)) {
        errors.push('Name cannot contain emojis');
    }
    
    // Убираем опасные символы
    const dangerousChars = /[<>{}[\]\\]/;
    if (dangerousChars.test(sanitized)) {
        errors.push('Name contains invalid characters');
    }
    
    return {
        isValid: errors.length === 0,
        sanitized: sanitized.trim(),
        errors
    };
};

const validateBio = (bio) => {
    if (!bio || bio.trim() === '') {
        return { isValid: true, sanitized: null };
    }
    
    let sanitized = sanitizeInput(bio);
    
    // Максимальная длина
    if (sanitized.length > 500) {
        return { isValid: false, errors: ['Bio must not exceed 500 characters'] };
    }
    
    // Экранируем HTML
    sanitized = escapeHtml(sanitized);
    
    // Разрешаем буквы, цифры, пробелы, базовую пунктуацию
    // Убираем потенциально опасное
    sanitized = sanitized.replace(/[<>{}[\]\\]/g, '');
    
    return {
        isValid: true,
        sanitized,
        errors: []
    };
};

const validateRegistration = (data) => {
    const errors = {};
    
    // Валидация email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
        errors.email = emailValidation.errors;
    }
    
    // Валидация пароля
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors;
    }
    
    // Валидация подтверждения пароля
    if (data.password !== data.confirmPassword) {
        errors.confirmPassword = ['Passwords do not match'];
    }
    
    // Валидация имени
    const nameValidation = validateName(data.name);
    if (!nameValidation.isValid) {
        errors.name = nameValidation.errors;
    }
    
    // Валидация bio (если есть)
    if (data.bio) {
        const bioValidation = validateBio(data.bio);
        if (!bioValidation.isValid) {
            errors.bio = bioValidation.errors;
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedData: {
            email: emailValidation.isValid ? emailValidation.sanitized : data.email,
            name: nameValidation.isValid ? nameValidation.sanitized : data.name,
            bio: data.bio ? validateBio(data.bio).sanitized : null
        }
    };
};

const validateLogin = (data) => {
    const errors = {};
    
    // Email обязателен
    if (!data.email || data.email.trim() === '') {
        errors.email = ['Email is required'];
    } else {
        const emailValidation = validateEmail(data.email);
        if (!emailValidation.isValid) {
            errors.email = emailValidation.errors;
        }
    }
    
    // Пароль обязателен
    if (!data.password) {
        errors.password = ['Password is required'];
    } else if (data.password.length < 8) {
        errors.password = ['Password must be at least 8 characters'];
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedEmail: data.email ? sanitizeEmail(data.email) : null
    };
};

const validateProfileUpdate = (data) => {
    const errors = {};
    
    // Валидация email (если передан)
    if (data.email && data.email !== '') {
        const emailValidation = validateEmail(data.email);
        if (!emailValidation.isValid) {
            errors.email = emailValidation.errors;
        }
    }
    
    // Валидация имени (если передано)
    if (data.name && data.name !== '') {
        const nameValidation = validateName(data.name);
        if (!nameValidation.isValid) {
            errors.name = nameValidation.errors;
        }
    }
    
    // Валидация bio (если передана)
    if (data.bio && data.bio !== '') {
        const bioValidation = validateBio(data.bio);
        if (!bioValidation.isValid) {
            errors.bio = bioValidation.errors;
        }
    }
    
    // Валидация пароля (если передан)
    if (data.newPassword && data.newPassword !== '') {
        const passwordValidation = validatePassword(data.newPassword);
        if (!passwordValidation.isValid) {
            errors.newPassword = passwordValidation.errors;
        }
        
        // Проверка совпадения паролей
        if (data.newPassword !== data.confirmPassword) {
            errors.confirmPassword = ['Passwords do not match'];
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedData: {
            email: data.email ? sanitizeEmail(data.email) : null,
            name: data.name ? sanitizeInput(data.name).trim() : null,
            bio: data.bio ? validateBio(data.bio).sanitized : null
        }
    };
};

const validateRegistrationMiddleware = (req, res, next) => {
    const validation = validateRegistration(req.body);
    
    if (!validation.isValid) {
        // Просто передаем ошибки дальше в контроллер
        req.validationErrors = validation.errors;
        req.validationData = req.body;
        return next();
    }
    
    // Подменяем данные на очищенные
    req.body.email = validation.sanitizedData.email;
    req.body.name = validation.sanitizedData.name;
    req.body.bio = validation.sanitizedData.bio;
    
    next();
};

const validateLoginMiddleware = (req, res, next) => {
    const validation = validateLogin(req.body);
    
    if (!validation.isValid) {
        return res.render('pages/auth/login', {
            title: 'Login',
            errors: validation.errors,
            formData: { email: req.body.email }
        });
    }
    
    req.body.email = validation.sanitizedEmail;
    
    next();
};

const validateProfileUpdateMiddleware = (req, res, next) => {
    const validation = validateProfileUpdate(req.body);
    
    if (!validation.isValid) {
        // Сохраняем ошибки в сессию или редиректим с параметрами
        const errorMessages = [];
        for (const [field, errors] of Object.entries(validation.errors)) {
            errorMessages.push(...errors);
        }
        return res.redirect('/auth/profile?error=' + encodeURIComponent(errorMessages.join(', ')));
    }
    
    // Подменяем данные на очищенные
    if (validation.sanitizedData.email) req.body.email = validation.sanitizedData.email;
    if (validation.sanitizedData.name) req.body.name = validation.sanitizedData.name;
    if (validation.sanitizedData.bio) req.body.bio = validation.sanitizedData.bio;
    
    next();
};

// Валидация имени организации
const validateOrganizationName = (name) => {
    const errors = [];
    
    if (!name || name.trim() === '') {
        errors.push('Organization name is required');
        return { isValid: false, errors };
    }
    
    const sanitized = name.trim();
    
    if (sanitized.length < 2) {
        errors.push('Name must be at least 2 characters');
    }
    if (sanitized.length > 150) {
        errors.push('Name must not exceed 150 characters');
    }

    // Разрешаем: латиницу, кириллицу, иероглифы, пробелы, дефисы, апострофы
    // Используем Unicode категории: L (буквы), Zs (пробелы), P (пунктуация)
    const nameRegex = /^[\p{L}\s\-':",.]+$/u;
    if (!nameRegex.test(sanitized)) {
        errors.push('Name can only contain letters, spaces, and characters: , . - \' : "');
    }

    // Проверка на эмодзи
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(sanitized)) {
        errors.push('Name cannot contain emojis');
    }
    
    // Проверка на опасные символы
    const dangerousChars = /[<>{}[\]\\]/;
    if (dangerousChars.test(sanitized)) {
        errors.push('Name contains invalid characters');
    }
    
    return {
        isValid: errors.length === 0,
        sanitized,
        errors
    };
};

// Валидация website
const validateWebsite = (website) => {
    const errors = [];
    
    if (!website || website.trim() === '') {
        return { isValid: true, sanitized: null };
    }
    
    const sanitized = website.trim();
    
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(sanitized)) {
        errors.push('Please enter a valid URL');
    }
    
    if (sanitized.length > 70) {
        errors.push('Website URL must not exceed 70 characters');
    }
    
    return {
        isValid: errors.length === 0,
        sanitized,
        errors
    };
};

// Валидация description организации
const validateOrganizationDescription = (description) => {
    const errors = [];
    
    if (!description || description.trim() === '') {
        return { isValid: true, sanitized: null };
    }
    
    const sanitized = description.trim();
    
    if (sanitized.length > 1000) {
        errors.push('Description must not exceed 1000 characters');
    }
    
    // Экранируем HTML
    const escaped = escapeHtml(sanitized);
    
    return {
        isValid: errors.length === 0,
        sanitized: escaped,
        errors
    };
};

// Основная функция валидации организации
const validateOrganization = (data) => {
    const errors = {};
    
    // Валидация имени
    const nameValidation = validateOrganizationName(data.name);
    if (!nameValidation.isValid) {
        errors.name = nameValidation.errors;
    }
    
    // Валидация email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
        errors.email = emailValidation.errors;
    }
    
    // Валидация website
    const websiteValidation = validateWebsite(data.website);
    if (!websiteValidation.isValid) {
        errors.website = websiteValidation.errors;
    }
    
    // Валидация description
    const descriptionValidation = validateOrganizationDescription(data.description);
    if (!descriptionValidation.isValid) {
        errors.description = descriptionValidation.errors;
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedData: {
            name: nameValidation.isValid ? nameValidation.sanitized : null,
            email: emailValidation.isValid ? emailValidation.sanitized : null,
            website: websiteValidation.isValid ? websiteValidation.sanitized : null,
            description: descriptionValidation.isValid ? descriptionValidation.sanitized : null
        }
    };
};

const validateOrganizationMiddleware = (req, res, next) => {
    const validation = validateOrganization(req.body);
    
    if (!validation.isValid) {
        req.validationErrors = validation.errors;
        req.validationData = req.body;
        return next();
    }
    
    req.body.name = validation.sanitizedData.name;
    req.body.email = validation.sanitizedData.email;
    req.body.website = validation.sanitizedData.website;
    req.body.description = validation.sanitizedData.description;
    
    next();
};

module.exports = {
    // Email/Password/Name/Bio
    validateEmail,
    validatePassword,
    validateName,
    validateBio,

    // Registration/Login
    validateRegistration,
    validateLogin,
    validateProfileUpdate,

    // Organization validations
    validateOrganizationName,
    validateWebsite,
    validateOrganizationDescription,
    validateOrganization,

    // Middlewares
    validateRegistrationMiddleware,
    validateLoginMiddleware,
    validateProfileUpdateMiddleware,
    validateOrganizationMiddleware,

    // Sanitizers
    sanitizeInput,
    sanitizeEmail
};