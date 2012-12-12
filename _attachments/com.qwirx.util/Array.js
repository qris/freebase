goog.provide('com.qwirx.util.Array');

/**
	@namespace
	@name com.qwirx.util.Array
*/

/**
 * Invert an array, swapping keys and values, like
 * goog.object.transpose but ignoring properties which are not
 * array indices. Useful for enumerating an array with a simple
 * for loop. Array keys can only be strings, so you can only invert
 * an array whose values are all strings, or convertible to strings.
 */
com.qwirx.util.Array.invert = function(arr)
{
	var l = arr.length;
	var out = {};
	
    for (var i = 0; i < l; i++)
    {
    	out[arr[i]] = i;
    }
    
    return out;
};

/**
 * Like {com.qwirx.util.Array.invert}, but constructs the array
 * from its arguments, syntactic sugar for constructing an array
 * to iterate over.
 */
com.qwirx.util.Array.withKeys = function(/* varargs */)
{
	return com.qwirx.util.Array.invert(arguments);	
};

/**
 * Binary search on a sorted structure, to find an existing node OR
 * the correct insertion point to maintain sort order.
 *
 * @param length The number of items in the structure, i.e. the
 * maximum index that may be passed to compareFn plus one.
 *
 * @param compareFn a generic comparison function that, given an
 * index into the data (its only parameter) returns 0 if the data
 * item at that index is the target; < 0 if it's after the target
 * and > 0 if it's before the target. This is just a generalisation
 * of the usual comparator function to any indexable data structure.
 * For example:
 *
 * <pre>
 * binarySearch(array.length, function(i) {
 *     return goog.array.defaultCompare(array[i].name, target.name);
 * }
 * </pre>
 *
 * @return an index >=0 of an existing node, or ~index (< 0) with the
 * insertion point if no matching node exists already.
 */
com.qwirx.util.Array.binarySearch = function(length, compareFn)
{
	var left = 0;  // inclusive
	var right = length;  // exclusive
	var found;
	
	while (left < right)
	{
		var middle = (left + right) >> 1;
		var compareResult = compareFn(middle);
		if (compareResult > 0)
		{
			left = middle + 1;
		}
		else
		{
			right = middle;
			// We are looking for the lowest index so we can't return immediately.
			found = !compareResult;
		}
	}
	
	// left is the index if found, or the insertion point otherwise.
	// ~left is a shorthand for -left - 1.
	
	return found ? left : ~left;
};

