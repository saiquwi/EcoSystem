const express = require('express');
const router = express.Router();
const problemController = require('../controllers/problemController');
const { isAuthenticated } = require('../middleware/auth');
const { uploadProblems } = require('../middleware/upload');

// GET - доступно всем
router.get('/', problemController.getAll);
router.get('/:id', problemController.getOne);

// POST - только авторизованные, с загрузкой фото
router.post('/', isAuthenticated, uploadProblems, problemController.create);

router.post('/:id/confirm', isAuthenticated, problemController.confirm);
router.post('/:id/take', isAuthenticated, problemController.take);
router.post('/:id/complete', isAuthenticated, problemController.complete);
router.post('/:id/confirm-resolution', isAuthenticated, problemController.confirmResolution);
router.delete('/:id', isAuthenticated, problemController.delete);

module.exports = router;