goog.provide('com.qwirx.util.Enum');

/**
	@namespace
	@name com.qwirx.util
*/

/**
 * Convert an array to a hash whose values are the same strings
 * as the keys, which is a nice property for an enumeration, and
 * saves us having to duplicate them. For example:
 *
 * <pre>
com.qwirx.freebase.Freebase.Gui.OpenMode = 
	new com.qwirx.util.Enum(['DATA', 'DESIGN']);
assert(com.qwirx.freebase.Freebase.Gui.OpenMode.DESIGN == 'DESIGN');
</pre>
 *
 * @see http://stackoverflow.com/a/6672823/648162
 */
com.qwirx.util.Enum = function(/* varargs */)
{
    for (var i in arguments)
    {
        this[arguments[i]] = arguments[i];
    }
};

/*
com.qwirx.freebase.Freebase.Gui.OpenMode = 
	new com.qwirx.util.Enum(['DATA', 'DESIGN']);
*/

