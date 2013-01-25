goog.provide('com.qwirx.test.assertThrows');
goog.provide('com.qwirx.test.assertInstanceof');

goog.require('goog.testing.asserts');
goog.require('goog.debug.reflect');

/**
 * Modified {assertThrows} that checks the type of the exception.
 *
 * @param {function} type The type (class) of exception expected.
 *
 * @param {function=} func the function expected to throw the 
 * exception.
 *
 * @param {string=} opt_comment Failure message (optional).
 * 
 * @return {*} The error thrown by the function.
 */
com.qwirx.test.assertThrows = function(type, func, opt_comment)
{
	_assert(opt_comment, typeof func == 'function',
		'Argument passed to assertThrows is not a function');
	
	var exception;
	if (opt_comment)
	{
		exception = assertThrows(opt_comment, func);
	}
	else
	{
		exception = assertThrows(func);
	}

	// com.qwirx.test.assertInstanceof(exception, type, opt_comment);
	
	if (exception instanceof type)
	{
		return exception;
	}
	else
	{
		throw exception;
	}	
};

/**
 * Checks if the value is an instance of the user-defined type if
 * goog.asserts.ENABLE_ASSERTS is true.
 *
 * The compiler may tighten the type returned by this function.
 *
 * @param {*} value The value to check.
 * @param {!Function} type A user-defined constructor.
 * @param {string=} opt_message Error message in case of failure.
 * @param {...*} var_args The items to substitute into the failure message.
 * @throws {goog.asserts.AssertionError} When the value is not an instance of
 *     type.
 * @return {!Object}
 */
com.qwirx.test.assertInstanceof = function(actual_value, expected_type,
	opt_message, var_args)
{
	goog.debug.reflect.init_();
	goog.debug.reflect.registerType_('TypeError', TypeError);

	if (goog.asserts.ENABLE_ASSERTS &&
		!(actual_value instanceof expected_type))
	{
		var detailed_message = goog.testing.asserts.getDefaultErrorMsg_(
			expected_type, goog.debug.reflect.typeOf(actual_value));
		goog.asserts.doAssertFailure_(
			'instanceof check failed: ' + detailed_message, null,	
			opt_message + ': ' + detailed_message,
			Array.prototype.slice.call(arguments, 3));
	}
	
	return /** @type {!Object} */(value);
};

