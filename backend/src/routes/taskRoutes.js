const router = require('express').Router();
const ctrl = require('../controllers/taskController');
const { taskValidator, taskEditValidator, taskStatusValidator } = require('../validators/taskValidator');
const validate = require('../utils/validate');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', taskValidator, validate, ctrl.create);
router.put('/:id', taskStatusValidator, validate, ctrl.updateStatus);
router.put('/:id/edit', taskEditValidator, validate, ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/comments', ctrl.getComments);
router.post('/:id/comments', ctrl.addComment);

module.exports = router;