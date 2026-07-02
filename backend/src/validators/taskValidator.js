const { body } = require('express-validator');

const taskValidator = [
  body('intern_ids')
    .if(body('intern_id').not().exists())
    .isArray({ min: 1 })
    .withMessage('At least one intern required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('due_date').optional().isDate().withMessage('Invalid due date'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
];

const taskStatusValidator = [
  body('status')
    .notEmpty()
    .isIn(['pending', 'completed'])
    .withMessage('Status must be pending or completed'),
  body('due_date').optional().isDate().withMessage('Invalid due date'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
];

module.exports = { taskValidator, taskStatusValidator };