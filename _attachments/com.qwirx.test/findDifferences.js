goog.provide('com.qwirx.test.findDifferences');

goog.require('goog.testing.asserts');

/**
 * Determines if two items of any type match, and formulates an error message
 * if not.
 * <p>
 * Copied and pasted from goog/testing/asserts.js just to add a limit
 * to the number of differences to avoid an infinite loop when
 * comparing objects with references to different DOM nodes.
 *
 * @param {*} expected Expected argument to match.
 * @param {*} actual Argument as a result of performing the test.
 * @return {?string} Null on success, error message on failure.
 */
goog.testing.asserts.findDifferences = function(expected, actual) {
  var failures = [];
  var seen1 = [];
  var seen2 = [];

  // To avoid infinite recursion when the two parameters are self-referential
  // along the same path of properties, keep track of the object pairs already
  // seen in this call subtree, and abort when a cycle is detected.
  // TODO(user,user): The algorithm still does not terminate in cases
  // with exponential recursion, e.g. a binary tree with leaf->root links.
  // Investigate ways to solve this without significant performance loss
  // for the common case.
  function innerAssert(var1, var2, path) {
  	if (failures.length > 100)
  	{
  		// It's already pretty borked. More information is not
  		// going to help.
  		return;
  	}
  	
    var depth = seen1.length;
    if (depth % 2) {
      // Compare with midpoint of seen ("Tortoise and hare" loop detection).
      // http://en.wikipedia.org/wiki/Cycle_detection#Tortoise_and_hare
      // TODO(user,user): For cases with complex cycles the algorithm
      // can take a long time to terminate, look into ways to terminate sooner
      // without adding more than constant-time work in non-cycle cases.
      var mid = depth >> 1;
      // Use === to avoid cases like ['x'] == 'x', which is true.
      var match1 = seen1[mid] === var1;
      var match2 = seen2[mid] === var2;
      if (match1 || match2) {
        if (!match1 || !match2) {
          // Asymmetric cycles, so the objects have different structure.
          failures.push('Asymmetric cycle detected at ' + path);
        }
        return;
      }
    }
    seen1.push(var1);
    seen2.push(var2);
    innerAssert_(var1, var2, path);
    seen1.pop();
    seen2.pop();
  }

  /**
   * @suppress {missingProperties} The map_ property is unknown to the compiler
   *     unless goog.structs.Map is loaded.
   */
  function innerAssert_(var1, var2, path) {
    if (var1 === var2) {
      return;
    }

    var typeOfVar1 = _trueTypeOf(var1);
    var typeOfVar2 = _trueTypeOf(var2);

    if (typeOfVar1 == typeOfVar2) {
      var isArray = typeOfVar1 == 'Array';
      var equalityPredicate = PRIMITIVE_EQUALITY_PREDICATES[typeOfVar1];
      if (equalityPredicate) {
        if (!equalityPredicate(var1, var2)) {
          failures.push(path + ' expected ' + _displayStringForValue(var1) +
                        ' but was ' + _displayStringForValue(var2));
        }
      } else if (isArray && var1.length != var2.length) {
        failures.push(path + ' expected ' + var1.length + '-element array ' +
                      'but got a ' + var2.length + '-element array');
      } else {
        var childPath = path + (isArray ? '[%s]' : (path ? '.%s' : '%s'));

        // if an object has an __iterator__ property, we have no way of
        // actually inspecting its raw properties, and JS 1.7 doesn't
        // overload [] to make it possible for someone to generically
        // use what the iterator returns to compare the object-managed
        // properties. This gets us into deep poo with things like
        // goog.structs.Map, at least on systems that support iteration.
        if (!var1['__iterator__']) {
          for (var prop in var1) {
            if (isArray && goog.testing.asserts.isArrayIndexProp_(prop)) {
              // Skip array indices for now. We'll handle them later.
              continue;
            }

            if (prop in var2) {
              innerAssert(var1[prop], var2[prop],
                          childPath.replace('%s', prop));
            } else {
              failures.push('property ' + prop +
                            ' not present in actual ' + (path || typeOfVar2));
            }
          }
          // make sure there aren't properties in var2 that are missing
          // from var1. if there are, then by definition they don't
          // match.
          for (var prop in var2) {
            if (isArray && goog.testing.asserts.isArrayIndexProp_(prop)) {
              // Skip array indices for now. We'll handle them later.
              continue;
            }

            if (!(prop in var1)) {
              failures.push('property ' + prop +
                            ' not present in expected ' +
                            (path || typeOfVar1));
            }
          }

          // Handle array indices by iterating from 0 to arr.length.
          //
          // Although all browsers allow holes in arrays, browsers
          // are inconsistent in what they consider a hole. For example,
          // "[0,undefined,2]" has a hole on IE but not on Firefox.
          //
          // Because our style guide bans for...in iteration over arrays,
          // we assume that most users don't care about holes in arrays,
          // and that it is ok to say that a hole is equivalent to a slot
          // populated with 'undefined'.
          if (isArray) {
            for (prop = 0; prop < var1.length; prop++) {
              innerAssert(var1[prop], var2[prop],
                          childPath.replace('%s', String(prop)));
            }
          }
        } else {
          // special-case for closure objects that have iterators
          if (goog.isFunction(var1.equals)) {
            // use the object's own equals function, assuming it accepts an
            // object and returns a boolean
            if (!var1.equals(var2)) {
              failures.push('equals() returned false for ' +
                            (path || typeOfVar1));
            }
          } else if (var1.map_) {
            // assume goog.structs.Map or goog.structs.Set, where comparing
            // their private map_ field is sufficient
            innerAssert(var1.map_, var2.map_, childPath.replace('%s', 'map_'));
          } else {
            // else die, so user knows we can't do anything
            failures.push('unable to check ' + (path || typeOfVar1) +
                          ' for equality: it has an iterator we do not ' +
                          'know how to handle. please add an equals method');
          }
        }
      }
    } else {
      failures.push(path + ' expected ' + _displayStringForValue(var1) +
                    ' but was ' + _displayStringForValue(var2));
    }
  }

  innerAssert(expected, actual, '');
  return failures.length == 0 ? null :
      'Expected ' + _displayStringForValue(expected) + ' but was ' +
      _displayStringForValue(actual) + '\n   ' + failures.join('\n   ');
};


