goog.provide('com.qwirx.util.Tree');

/**
	@namespace
	@name com.qwirx.util.Tree
*/

goog.require('com.qwirx.util.Array');

/**
 * Binary search on a sorted tree (actually any BaseNode) to find the
 * correct insertion point to maintain sort order.
 */
com.qwirx.util.Tree.treeSearch = function(node, compareNodeFn, target)
{
	return com.qwirx.util.Array.binarySearch(
		node.getChildCount(),
		function compareFn(atIndex)
		{
			return compareNodeFn(target, node.getChildAt(atIndex));
		});
};


