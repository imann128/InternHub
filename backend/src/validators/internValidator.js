const { body } = require('express-validator');

const internValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('joining_date').notEmpty().isDate().withMessage('Valid joining date is required'),
  body('location_id')
    .optional({ checkFalsy: true })
    .isInt().withMessage('Invalid location'),
];

module.exports = internValidator;
