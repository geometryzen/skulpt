//
//
//
(
/**
 * @param {?*} global
 * @param {(function():*)=} define
 * @suppress {missingProperties}
 */
function(global, define) {
  var globalDefine = global.define;
// Experiment to make the generated library Google Closure compatible.

/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(
/**
 * @param {?undefined=} undef
 */
function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {string} name the relative name
     * @param {string} baseName a real name that the name arg is relative
     * to.
     * @returns {string} normalized name
     */
    function normalize(name, baseName) {
        /**
         * @type {Array.<string>}
         */
        var nameParts;
        var nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                nameParts = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(nameParts[lastIndex])) {
                    nameParts[lastIndex] = nameParts[lastIndex].replace(jsSuffixRegExp, '');
                }

                nameParts = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < nameParts.length; i += 1) {
                    part = nameParts[i];
                    if (part === ".") {
                        nameParts.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (nameParts[2] === '..' || nameParts[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            nameParts.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = nameParts.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    /**
     * @param {string} relName
     * @param {boolean=} forceSync
     */
    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    /**
     * @param {Object|string|undefined} deps
     * @param {?=} callback
     * @param {?=} relName
     * @param {boolean=} forceSync
     * @param {boolean=} alt
     */
    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    /**
     * @param {string} name
     * @param {*} deps
     * @param {*=} callback
     */
    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}(undefined));

define("../manual-deps/almond/almond", function(){});

define('davinci-py/core',[],function()
{
  var that =
  {
    VERSION: '0.0.9'
  };
  return that;
});
define('davinci-py/base',[], function () {
// Copyright 2006 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var COMPILED = false;


/**
 * Base namespace for the Closure library.  Checks to see base is already
 * defined in the current scope before assigning to prevent clobbering if
 * base.js is loaded more than once.
 *
 * @const
 */
var base = base || {};


/**
 * Reference to the global context.  In most cases this will be 'window'.
 */
base.global = this;

/**
 * Builds an object structure for the provided namespace path, ensuring that
 * names that already exist are not overwritten. For example:
 * "a.b.c" -> a = {};a.b={};a.b.c={};
 * Used by base.provide and base.exportSymbol.
 * @param {string} name name of the object that this file defines.
 * @param {*=} opt_object the object to expose at the end of the path.
 * @param {Object=} opt_objectToExportTo The object to add the path to; default
 *     is |base.global|.
 * @private
 */
base.exportPath_ = function(name, opt_object, opt_objectToExportTo) {
  var parts = name.split('.');
  var cur = opt_objectToExportTo || base.global;

  // Internet Explorer exhibits strange behavior when throwing errors from
  // methods externed in this manner.  See the testExportSymbolExceptions in
  // base_test.html for an example.
  if (!(parts[0] in cur) && cur.execScript) {
    cur.execScript('var ' + parts[0]);
  }

  // Certain browsers cannot parse code in the form for((a in b); c;);
  // This pattern is produced by the JSCompiler when it collapses the
  // statement above into the conditional loop below. To prevent this from
  // happening, use a for-loop and reserve the init logic as below.

  // Parentheses added to eliminate strict JS warning in Firefox.
  for (var part; parts.length && (part = parts.shift());) {
    if (!parts.length && opt_object !== undefined) {
      // last part and we have an object; use it
      cur[part] = opt_object;
    } else if (cur[part]) {
      cur = cur[part];
    } else {
      cur = cur[part] = {};
    }
  }
};

base.DEBUG = true;

/**
 * Returns an object based on its fully qualified external name.  If you are
 * using a compilation pass that renames property names beware that using this
 * function will not find renamed properties.
 *
 * @param {string} name The fully qualified name.
 * @param {Object=} opt_obj The object within which to look; default is
 *     |base.global|.
 * @return {?} The value (object or primitive) or, if not found, null.
 */
base.getObjectByName = function(name, opt_obj) {
  var parts = name.split('.');
  var cur = opt_obj || base.global;
  for (var part; part = parts.shift(); ) {
    if (base.isDefAndNotNull(cur[part])) {
      cur = cur[part];
    } else {
      return null;
    }
  }
  return cur;
};


/**
 * Globalizes a whole namespace, such as base or base.lang.
 *
 * @param {Object} obj The namespace to globalize.
 * @param {Object=} opt_global The object to add the properties to.
 * @deprecated Properties may be explicitly exported to the global scope, but
 *     this should no longer be done in bulk.
 */
base.globalize = function(obj, opt_global) {
  var global = opt_global || base.global;
  for (var x in obj) {
    global[x] = obj[x];
  }
};

/**
 * Null function used for default values of callbacks, etc.
 * @return {void} Nothing.
 */
base.nullFunction = function() {};


/**
 * The identity function. Returns its first argument.
 *
 * @param {*=} opt_returnValue The single value that will be returned.
 * @param {...*} var_args Optional trailing arguments. These are ignored.
 * @return {?} The first argument. We can't know the type -- just pass it along
 *      without type.
 * @deprecated Use base.functions.identity instead.
 */
base.identityFunction = function(opt_returnValue, var_args) {
  return opt_returnValue;
};


/**
 * When defining a class Foo with an abstract method bar(), you can do:
 * Foo.prototype.bar = base.abstractMethod
 *
 * Now if a subclass of Foo fails to override bar(), an error will be thrown
 * when bar() is invoked.
 *
 * Note: This does not take the name of the function to override as an argument
 * because that would make it more difficult to obfuscate our JavaScript code.
 *
 * @type {!Function}
 * @throws {Error} when invoked to indicate the method should be overridden.
 */
base.abstractMethod = function() {
  throw Error('unimplemented abstract method');
};

//==============================================================================
// Language Enhancements
//==============================================================================


/**
 * This is a "fixed" version of the typeof operator.  It differs from the typeof
 * operator in such a way that null returns 'null' and arrays return 'array'.
 * @param {*} value The value to get the type of.
 * @return {string} The name of the type.
 */
base.typeOf = function(value) {
  var s = typeof value;
  if (s == 'object') {
    if (value) {
      // Check these first, so we can avoid calling Object.prototype.toString if
      // possible.
      //
      // IE improperly marshals tyepof across execution contexts, but a
      // cross-context object will still return false for "instanceof Object".
      if (value instanceof Array) {
        return 'array';
      } else if (value instanceof Object) {
        return s;
      }

      // HACK: In order to use an Object prototype method on the arbitrary
      //   value, the compiler requires the value be cast to type Object,
      //   even though the ECMA spec explicitly allows it.
      var className = Object.prototype.toString.call(
          /** @type {Object} */ (value));
      // In Firefox 3.6, attempting to access iframe window objects' length
      // property throws an NS_ERROR_FAILURE, so we need to special-case it
      // here.
      if (className == '[object Window]') {
        return 'object';
      }

      // We cannot always use constructor == Array or instanceof Array because
      // different frames have different Array objects. In IE6, if the iframe
      // where the array was created is destroyed, the array loses its
      // prototype. Then dereferencing val.splice here throws an exception, so
      // we can't use base.isFunction. Calling typeof directly returns 'unknown'
      // so that will work. In this case, this function will return false and
      // most array functions will still work because the array is still
      // array-like (supports length and []) even though it has lost its
      // prototype.
      // Mark Miller noticed that Object.prototype.toString
      // allows access to the unforgeable [[Class]] property.
      //  15.2.4.2 Object.prototype.toString ( )
      //  When the toString method is called, the following steps are taken:
      //      1. Get the [[Class]] property of this object.
      //      2. Compute a string value by concatenating the three strings
      //         "[object ", Result(1), and "]".
      //      3. Return Result(2).
      // and this behavior survives the destruction of the execution context.
      if ((className == '[object Array]' ||
           // In IE all non value types are wrapped as objects across window
           // boundaries (not iframe though) so we have to do object detection
           // for this edge case.
           typeof value.length == 'number' &&
           typeof value.splice != 'undefined' &&
           typeof value.propertyIsEnumerable != 'undefined' &&
           !value.propertyIsEnumerable('splice')

          )) {
        return 'array';
      }
      // HACK: There is still an array case that fails.
      //     function ArrayImpostor() {}
      //     ArrayImpostor.prototype = [];
      //     var impostor = new ArrayImpostor;
      // this can be fixed by getting rid of the fast path
      // (value instanceof Array) and solely relying on
      // (value && Object.prototype.toString.vall(value) === '[object Array]')
      // but that would require many more function calls and is not warranted
      // unless closure code is receiving objects from untrusted sources.

      // IE in cross-window calls does not correctly marshal the function type
      // (it appears just as an object) so we cannot use just typeof val ==
      // 'function'. However, if the object has a call property, it is a
      // function.
      if ((className == '[object Function]' ||
          typeof value.call != 'undefined' &&
          typeof value.propertyIsEnumerable != 'undefined' &&
          !value.propertyIsEnumerable('call'))) {
        return 'function';
      }

    } else {
      return 'null';
    }

  } else if (s == 'function' && typeof value.call == 'undefined') {
    // In Safari typeof nodeList returns 'function', and on Firefox typeof
    // behaves similarly for HTML{Applet,Embed,Object}, Elements and RegExps. We
    // would like to return object for those and we can detect an invalid
    // function by making sure that the function object has a call method.
    return 'object';
  }
  return s;
};


/**
 * Returns true if the specified value is not undefined.
 * WARNING: Do not use this to test if an object has a property. Use the in
 * operator instead.  Additionally, this function assumes that the global
 * undefined variable has not been redefined.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is defined.
 */
base.isDef = function(val) {
  return val !== undefined;
};


/**
 * Returns true if the specified value is null.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is null.
 */
base.isNull = function(val) {
  return val === null;
};


/**
 * Returns true if the specified value is defined and not null.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is defined and not null.
 */
base.isDefAndNotNull = function(val) {
  // Note that undefined == null.
  return val != null;
};


/**
 * Returns true if the specified value is an array.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is an array.
 */
base.isArray = function(val) {
  return base.typeOf(val) == 'array';
};


/**
 * Returns true if the object looks like an array. To qualify as array like
 * the value needs to be either a NodeList or an object with a Number length
 * property.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is an array.
 */
base.isArrayLike = function(val) {
  var type = base.typeOf(val);
  return type == 'array' || type == 'object' && typeof val.length == 'number';
};


/**
 * Returns true if the object looks like a Date. To qualify as Date-like the
 * value needs to be an object and have a getFullYear() function.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is a like a Date.
 */
base.isDateLike = function(val) {
  return base.isObject(val) && typeof val.getFullYear == 'function';
};


/**
 * Returns true if the specified value is a string.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is a string.
 */
base.isString = function(val) {
  return typeof val == 'string';
};


/**
 * Returns true if the specified value is a boolean.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is boolean.
 */
base.isBoolean = function(val) {
  return typeof val == 'boolean';
};


/**
 * Returns true if the specified value is a number.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is a number.
 */
base.isNumber = function(val) {
  return typeof val == 'number';
};


/**
 * Returns true if the specified value is a function.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is a function.
 */
base.isFunction = function(val) {
  return base.typeOf(val) == 'function';
};


/**
 * Returns true if the specified value is an object.  This includes arrays and
 * functions.
 * @param {*} val Variable to test.
 * @return {boolean} Whether variable is an object.
 */
base.isObject = function(val) {
  var type = typeof val;
  return type == 'object' && val != null || type == 'function';
  // return Object(val) === val also works, but is slower, especially if val is
  // not an object.
};


/**
 * Gets a unique ID for an object. This mutates the object so that further calls
 * with the same object as a parameter returns the same value. The unique ID is
 * guaranteed to be unique across the current session amongst objects that are
 * passed into {@code getUid}. There is no guarantee that the ID is unique or
 * consistent across sessions. It is unsafe to generate unique ID for function
 * prototypes.
 *
 * @param {Object} obj The object to get the unique ID for.
 * @return {number} The unique ID for the object.
 */
base.getUid = function(obj) {
  // TODO(arv): Make the type stricter, do not accept null.

  // In Opera window.hasOwnProperty exists but always returns false so we avoid
  // using it. As a consequence the unique ID generated for BaseClass.prototype
  // and SubClass.prototype will be the same.
  return obj[base.UID_PROPERTY_] ||
      (obj[base.UID_PROPERTY_] = ++base.uidCounter_);
};


/**
 * Removes the unique ID from an object. This is useful if the object was
 * previously mutated using {@code base.getUid} in which case the mutation is
 * undone.
 * @param {Object} obj The object to remove the unique ID field from.
 */
base.removeUid = function(obj) {
  // TODO(arv): Make the type stricter, do not accept null.

  // In IE, DOM nodes are not instances of Object and throw an exception if we
  // try to delete.  Instead we try to use removeAttribute.
  if ('removeAttribute' in obj) {
    obj.removeAttribute(base.UID_PROPERTY_);
  }
  /** @preserveTry */
  try {
    delete obj[base.UID_PROPERTY_];
  } catch (ex) {
  }
};


/**
 * Name for unique ID property. Initialized in a way to help avoid collisions
 * with other closure JavaScript on the same page.
 * @type {string}
 * @private
 */
base.UID_PROPERTY_ = 'closure_uid_' + ((Math.random() * 1e9) >>> 0);


/**
 * Counter for UID.
 * @type {number}
 * @private
 */
base.uidCounter_ = 0;


/**
 * Adds a hash code field to an object. The hash code is unique for the
 * given object.
 * @param {Object} obj The object to get the hash code for.
 * @return {number} The hash code for the object.
 * @deprecated Use base.getUid instead.
 */
base.getHashCode = base.getUid;


/**
 * Removes the hash code field from an object.
 * @param {Object} obj The object to remove the field from.
 * @deprecated Use base.removeUid instead.
 */
base.removeHashCode = base.removeUid;


/**
 * Clones a value. The input may be an Object, Array, or basic type. Objects and
 * arrays will be cloned recursively.
 *
 * WARNINGS:
 * <code>base.cloneObject</code> does not detect reference loops. Objects that
 * refer to themselves will cause infinite recursion.
 *
 * <code>base.cloneObject</code> is unaware of unique identifiers, and copies
 * UIDs created by <code>getUid</code> into cloned results.
 *
 * @param {*} obj The value to clone.
 * @return {*} A clone of the input value.
 * @deprecated base.cloneObject is unsafe. Prefer the base.object methods.
 */
base.cloneObject = function(obj) {
  var type = base.typeOf(obj);
  if (type == 'object' || type == 'array') {
    if (obj.clone) {
      return obj.clone();
    }
    var clone = type == 'array' ? [] : {};
    for (var key in obj) {
      clone[key] = base.cloneObject(obj[key]);
    }
    return clone;
  }

  return obj;
};


/**
 * A native implementation of base.bind.
 * @param {Function} fn A function to partially apply.
 * @param {Object|undefined} selfObj Specifies the object which this should
 *     point to when the function is run.
 * @param {...*} var_args Additional arguments that are partially applied to the
 *     function.
 * @return {!Function} A partially-applied form of the function bind() was
 *     invoked as a method of.
 * @private
 * @suppress {deprecated} The compiler thinks that Function.prototype.bind is
 *     deprecated because some people have declared a pure-JS version.
 *     Only the pure-JS version is truly deprecated.
 */
base.bindNative_ = function(fn, selfObj, var_args) {
  return /** @type {!Function} */ (fn.call.apply(fn.bind, arguments));
};


/**
 * A pure-JS implementation of base.bind.
 * @param {Function} fn A function to partially apply.
 * @param {Object|undefined} selfObj Specifies the object which this should
 *     point to when the function is run.
 * @param {...*} var_args Additional arguments that are partially applied to the
 *     function.
 * @return {!Function} A partially-applied form of the function bind() was
 *     invoked as a method of.
 * @private
 */
base.bindJs_ = function(fn, selfObj, var_args) {
  if (!fn) {
    throw new Error();
  }

  if (arguments.length > 2) {
    var boundArgs = Array.prototype.slice.call(arguments, 2);
    return function() {
      // Prepend the bound arguments to the current arguments.
      var newArgs = Array.prototype.slice.call(arguments);
      Array.prototype.unshift.apply(newArgs, boundArgs);
      return fn.apply(selfObj, newArgs);
    };

  } else {
    return function() {
      return fn.apply(selfObj, arguments);
    };
  }
};


/**
 * Partially applies this function to a particular 'this object' and zero or
 * more arguments. The result is a new function with some arguments of the first
 * function pre-filled and the value of this 'pre-specified'.
 *
 * Remaining arguments specified at call-time are appended to the pre-specified
 * ones.
 *
 * Also see: {@link #partial}.
 *
 * Usage:
 * <pre>var barMethBound = bind(myFunction, myObj, 'arg1', 'arg2');
 * barMethBound('arg3', 'arg4');</pre>
 *
 * @param {?function(this:T, ...)} fn A function to partially apply.
 * @param {T} selfObj Specifies the object which this should point to when the
 *     function is run.
 * @param {...*} var_args Additional arguments that are partially applied to the
 *     function.
 * @return {!Function} A partially-applied form of the function bind() was
 *     invoked as a method of.
 * @template T
 * @suppress {deprecated} See above.
 */
base.bind = function(fn, selfObj, var_args) {
  // TODO(nicksantos): narrow the type signature.
  if (Function.prototype.bind &&
      // NOTE(nicksantos): Somebody pulled base.js into the default Chrome
      // extension environment. This means that for Chrome extensions, they get
      // the implementation of Function.prototype.bind that calls base.bind
      // instead of the native one. Even worse, we don't want to introduce a
      // circular dependency between base.bind and Function.prototype.bind, so
      // we have to hack this to make sure it works correctly.
      Function.prototype.bind.toString().indexOf('native code') != -1) {
    base.bind = base.bindNative_;
  } else {
    base.bind = base.bindJs_;
  }
  return base.bind.apply(null, arguments);
};


/**
 * Like bind(), except that a 'this object' is not required. Useful when the
 * target function is already bound.
 *
 * Usage:
 * var g = partial(f, arg1, arg2);
 * g(arg3, arg4);
 *
 * @param {Function} fn A function to partially apply.
 * @param {...*} var_args Additional arguments that are partially applied to fn.
 * @return {!Function} A partially-applied form of the function bind() was
 *     invoked as a method of.
 */
base.partial = function(fn, var_args) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function() {
    // Prepend the bound arguments to the current arguments.
    var newArgs = Array.prototype.slice.call(arguments);
    newArgs.unshift.apply(newArgs, args);
    return fn.apply(this, newArgs);
  };
};


/**
 * Copies all the members of a source object to a target object. This method
 * does not work on all browsers for all objects that contain keys such as
 * toString or hasOwnProperty. Use base.object.extend for this purpose.
 * @param {Object} target Target.
 * @param {Object} source Source.
 */
base.mixin = function(target, source) {
  for (var x in source) {
    target[x] = source[x];
  }

  // For IE7 or lower, the for-in-loop does not contain any properties that are
  // not enumerable on the prototype object (for example, isPrototypeOf from
  // Object.prototype) but also it will not include 'replace' on objects that
  // extend String and change 'replace' (not that it is common for anyone to
  // extend anything except Object).
};


/**
 * @return {number} An integer value representing the number of milliseconds
 *     between midnight, January 1, 1970 and the current time.
 */
base.now = (base.TRUSTED_SITE && Date.now) || (function() {
  // Unary plus operator converts its operand to a number which in the case of
  // a date is done by calling getTime().
  return +new Date();
});


/**
 * Evals JavaScript in the global scope.  In IE this uses execScript, other
 * browsers use base.global.eval. If base.global.eval does not evaluate in the
 * global scope (for example, in Safari), appends a script tag instead.
 * Throws an exception if neither execScript or eval is defined.
 * @param {string} script JavaScript string.
 */
base.globalEval = function(script) {
  if (base.global.execScript) {
    base.global.execScript(script, 'JavaScript');
  } else if (base.global.eval) {
    // Test to see if eval works
    if (base.evalWorksForGlobals_ == null) {
      base.global.eval('var _et_ = 1;');
      if (typeof base.global['_et_'] != 'undefined') {
        delete base.global['_et_'];
        base.evalWorksForGlobals_ = true;
      } else {
        base.evalWorksForGlobals_ = false;
      }
    }

    if (base.evalWorksForGlobals_) {
      base.global.eval(script);
    } else {
      var doc = base.global.document;
      var scriptElt = doc.createElement('script');
      scriptElt.type = 'text/javascript';
      scriptElt.defer = false;
      // Note(user): can't use .innerHTML since "t('<test>')" will fail and
      // .text doesn't work in Safari 2.  Therefore we append a text node.
      scriptElt.appendChild(doc.createTextNode(script));
      doc.body.appendChild(scriptElt);
      doc.body.removeChild(scriptElt);
    }
  } else {
    throw Error('base.globalEval not available');
  }
};


/**
 * Indicates whether or not we can call 'eval' directly to eval code in the
 * global scope. Set to a Boolean by the first call to base.globalEval (which
 * empirically tests whether eval works for globals). @see base.globalEval
 * @type {?boolean}
 * @private
 */
base.evalWorksForGlobals_ = null;


/**
 * Optional map of CSS class names to obfuscated names used with
 * base.getCssName().
 * @type {Object|undefined}
 * @private
 * @see base.setCssNameMapping
 */
base.cssNameMapping_;


/**
 * Optional obfuscation style for CSS class names. Should be set to either
 * 'BY_WHOLE' or 'BY_PART' if defined.
 * @type {string|undefined}
 * @private
 * @see base.setCssNameMapping
 */
base.cssNameMappingStyle_;


/**
 * Handles strings that are intended to be used as CSS class names.
 *
 * This function works in tandem with @see base.setCssNameMapping.
 *
 * Without any mapping set, the arguments are simple joined with a hyphen and
 * passed through unaltered.
 *
 * When there is a mapping, there are two possible styles in which these
 * mappings are used. In the BY_PART style, each part (i.e. in between hyphens)
 * of the passed in css name is rewritten according to the map. In the BY_WHOLE
 * style, the full css name is looked up in the map directly. If a rewrite is
 * not specified by the map, the compiler will output a warning.
 *
 * When the mapping is passed to the compiler, it will replace calls to
 * base.getCssName with the strings from the mapping, e.g.
 *     var x = base.getCssName('foo');
 *     var y = base.getCssName(this.baseClass, 'active');
 *  becomes:
 *     var x= 'foo';
 *     var y = this.baseClass + '-active';
 *
 * If one argument is passed it will be processed, if two are passed only the
 * modifier will be processed, as it is assumed the first argument was generated
 * as a result of calling base.getCssName.
 *
 * @param {string} className The class name.
 * @param {string=} opt_modifier A modifier to be appended to the class name.
 * @return {string} The class name or the concatenation of the class name and
 *     the modifier.
 */
base.getCssName = function(className, opt_modifier) {
  var getMapping = function(cssName) {
    return base.cssNameMapping_[cssName] || cssName;
  };

  var renameByParts = function(cssName) {
    // Remap all the parts individually.
    var parts = cssName.split('-');
    var mapped = [];
    for (var i = 0; i < parts.length; i++) {
      mapped.push(getMapping(parts[i]));
    }
    return mapped.join('-');
  };

  var rename;
  if (base.cssNameMapping_) {
    rename = base.cssNameMappingStyle_ == 'BY_WHOLE' ?
        getMapping : renameByParts;
  } else {
    rename = function(a) {
      return a;
    };
  }

  if (opt_modifier) {
    return className + '-' + rename(opt_modifier);
  } else {
    return rename(className);
  }
};


/**
 * Sets the map to check when returning a value from base.getCssName(). Example:
 * <pre>
 * base.setCssNameMapping({
 *   "base": "a",
 *   "disabled": "b",
 * });
 *
 * var x = base.getCssName('base');
 * // The following evaluates to: "a a-b".
 * base.getCssName('base') + ' ' + base.getCssName(x, 'disabled')
 * </pre>
 * When declared as a map of string literals to string literals, the JSCompiler
 * will replace all calls to base.getCssName() using the supplied map if the
 * --closure_pass flag is set.
 *
 * @param {!Object} mapping A map of strings to strings where keys are possible
 *     arguments to base.getCssName() and values are the corresponding values
 *     that should be returned.
 * @param {string=} opt_style The style of css name mapping. There are two valid
 *     options: 'BY_PART', and 'BY_WHOLE'.
 * @see base.getCssName for a description.
 */
base.setCssNameMapping = function(mapping, opt_style) {
  base.cssNameMapping_ = mapping;
  base.cssNameMappingStyle_ = opt_style;
};


/**
 * To use CSS renaming in compiled mode, one of the input files should have a
 * call to base.setCssNameMapping() with an object literal that the JSCompiler
 * can extract and use to replace all calls to base.getCssName(). In uncompiled
 * mode, JavaScript code should be loaded before this base.js file that declares
 * a global variable, CLOSURE_CSS_NAME_MAPPING, which is used below. This is
 * to ensure that the mapping is loaded before any calls to base.getCssName()
 * are made in uncompiled mode.
 *
 * A hook for overriding the CSS name mapping.
 * @type {Object|undefined}
 */
base.global.CLOSURE_CSS_NAME_MAPPING;


if (!COMPILED && base.global.CLOSURE_CSS_NAME_MAPPING) {
  // This does not call base.setCssNameMapping() because the JSCompiler
  // requires that base.setCssNameMapping() be called with an object literal.
  base.cssNameMapping_ = base.global.CLOSURE_CSS_NAME_MAPPING;
}


/**
 * Gets a localized message.
 *
 * This function is a compiler primitive. If you give the compiler a localized
 * message bundle, it will replace the string at compile-time with a localized
 * version, and expand base.getMsg call to a concatenated string.
 *
 * Messages must be initialized in the form:
 * <code>
 * var MSG_NAME = base.getMsg('Hello {$placeholder}', {'placeholder': 'world'});
 * </code>
 *
 * @param {string} str Translatable string, places holders in the form {$foo}.
 * @param {Object=} opt_values Map of place holder name to value.
 * @return {string} message with placeholders filled.
 */
base.getMsg = function(str, opt_values) {
  var values = opt_values || {};
  for (var key in values) {
    var value = ('' + values[key]).replace(/\$/g, '$$$$');
    str = str.replace(new RegExp('\\{\\$' + key + '\\}', 'gi'), value);
  }
  return str;
};


/**
 * Gets a localized message. If the message does not have a translation, gives a
 * fallback message.
 *
 * This is useful when introducing a new message that has not yet been
 * translated into all languages.
 *
 * This function is a compiler primtive. Must be used in the form:
 * <code>var x = base.getMsgWithFallback(MSG_A, MSG_B);</code>
 * where MSG_A and MSG_B were initialized with base.getMsg.
 *
 * @param {string} a The preferred message.
 * @param {string} b The fallback message.
 * @return {string} The best translated message.
 */
base.getMsgWithFallback = function(a, b) {
  return a;
};


/**
 * Exposes an unobfuscated global namespace path for the given object.
 * Note that fields of the exported object *will* be obfuscated, unless they are
 * exported in turn via this function or base.exportProperty.
 *
 * Also handy for making public items that are defined in anonymous closures.
 *
 * ex. base.exportSymbol('public.path.Foo', Foo);
 *
 * ex. base.exportSymbol('public.path.Foo.staticFunction', Foo.staticFunction);
 *     public.path.Foo.staticFunction();
 *
 * ex. base.exportSymbol('public.path.Foo.prototype.myMethod',
 *                       Foo.prototype.myMethod);
 *     new public.path.Foo().myMethod();
 *
 * @param {string} publicPath Unobfuscated name to export.
 * @param {*} object Object the name should point to.
 * @param {Object=} opt_objectToExportTo The object to add the path to; default
 *     is base.global.
 */
base.exportSymbol = function(publicPath, object, opt_objectToExportTo) {
  base.exportPath_(publicPath, object, opt_objectToExportTo);
};


/**
 * Exports a property unobfuscated into the object's namespace.
 * ex. base.exportProperty(Foo, 'staticFunction', Foo.staticFunction);
 * ex. base.exportProperty(Foo.prototype, 'myMethod', Foo.prototype.myMethod);
 * @param {Object} object Object whose static property is being exported.
 * @param {string} publicName Unobfuscated name to export.
 * @param {*} symbol Object the name should point to.
 */
base.exportProperty = function(object, publicName, symbol) {
  object[publicName] = symbol;
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * Usage:
 * <pre>
 * function ParentClass(a, b) { }
 * ParentClass.prototype.foo = function(a) { }
 *
 * function ChildClass(a, b, c) {
 *   base.base(this, a, b);
 * }
 * base.inherits(ChildClass, ParentClass);
 *
 * var child = new ChildClass('a', 'b', 'see');
 * child.foo(); // This works.
 * </pre>
 *
 * In addition, a superclass' implementation of a method can be invoked as
 * follows:
 *
 * <pre>
 * ChildClass.prototype.foo = function(a) {
 *   ChildClass.superClass_.foo.call(this, a);
 *   // Other code here.
 * };
 * </pre>
 *
 * @param {Function} childCtor Child class.
 * @param {Function} parentCtor Parent class.
 */
base.inherits = function(childCtor, parentCtor) {
  /** @constructor */
  function tempCtor() {};
  tempCtor.prototype = parentCtor.prototype;
  childCtor.superClass_ = parentCtor.prototype;
  childCtor.prototype = new tempCtor();
  /** @override */
  childCtor.prototype.constructor = childCtor;
};


/**
 * Call up to the superclass.
 *
 * If this is called from a constructor, then this calls the superclass
 * contsructor with arguments 1-N.
 *
 * If this is called from a prototype method, then you must pass the name of the
 * method as the second argument to this function. If you do not, you will get a
 * runtime error. This calls the superclass' method with arguments 2-N.
 *
 * This function only works if you use base.inherits to express inheritance
 * relationships between your classes.
 *
 * This function is a compiler primitive. At compile-time, the compiler will do
 * macro expansion to remove a lot of the extra overhead that this function
 * introduces. The compiler will also enforce a lot of the assumptions that this
 * function makes, and treat it as a compiler error if you break them.
 *
 * @param {!Object} me Should always be "this".
 * @param {*=} opt_methodName The method name if calling a super method.
 * @param {...*} var_args The rest of the arguments.
 * @return {*} The return value of the superclass method.
 */
base.base = function(me, opt_methodName, var_args) {
  var caller = arguments.callee.caller;

  if (base.DEBUG) {
    if (!caller) {
      throw Error('arguments.caller not defined.  base.base() expects not ' +
                  'to be running in strict mode. See ' +
                  'http://www.ecma-international.org/ecma-262/5.1/#sec-C');
    }
  }

  if (caller.superClass_) {
    // This is a constructor. Call the superclass constructor.
    return caller.superClass_.constructor.apply(
        me, Array.prototype.slice.call(arguments, 1));
  }

  var args = Array.prototype.slice.call(arguments, 2);
  var foundCaller = false;
  for (var ctor = me.constructor;
       ctor; ctor = ctor.superClass_ && ctor.superClass_.constructor) {
    if (ctor.prototype[opt_methodName] === caller) {
      foundCaller = true;
    } else if (foundCaller) {
      return ctor.prototype[opt_methodName].apply(me, args);
    }
  }

  // If we did not find the caller in the prototype chain, then one of two
  // things happened:
  // 1) The caller is an instance method.
  // 2) This method was not called by the right caller.
  if (me[opt_methodName] === caller) {
    return me.constructor.prototype[opt_methodName].apply(me, args);
  } else {
    throw Error(
        'base.base called from a method of one name ' +
        'to a method of a different name');
  }
};


/**
 * Allow for aliasing within scope functions.  This function exists for
 * uncompiled code - in compiled code the calls will be inlined and the aliases
 * applied.  In uncompiled code the function is simply run since the aliases as
 * written are valid JavaScript.
 * @param {function()} fn Function to call.  This function can contain aliases
 *     to namespaces (e.g. "var dom = base.dom") or classes
 *     (e.g. "var Timer = base.Timer").
 */
base.scope = function(fn) {
  fn.call(base.global);
};

return base;

});

define('davinci-py/asserts',[], function()
{
  function assert(condition, message)
  {
    if (!condition)
    {
      throw new Error(message);
    }
  }

  function fail(message)
  {
    assert(false, message);
  }

  var that =
  {
    assert: assert,
    fail: fail
  };

  return that;
});

define('davinci-py/tokenize',[], function()
{
    /*
     * This is a port of tokenize.py by Ka-Ping Yee.
     *
     * each call to readline should return one line of input as a string, or
     * undefined if it's finished.
     *
     * callback is called for each token with 5 args:
     * 1. the token type
     * 2. the token string
     * 3. [ start_row, start_col ]
     * 4. [ end_row, end_col ]
     * 5. logical line where the token was found, including continuation lines
     *
     * callback can return true to abort.
     *
     */

    /**
     * @constructor
     */
    var Tokenizer = function (filename, interactive, callback)
    {
        this.filename = filename;
        this.callback = callback;
        this.lnum = 0;
        this.parenlev = 0;
        this.continued = false;
        this.namechars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
        this.numchars = '0123456789';
        this.contstr = '';
        this.needcont = false;
        this.contline = undefined;
        this.indents = [0];
        this.endprog = /.*/;
        this.strstart = [-1,-1];
        this.interactive = interactive;
        this.doneFunc = function()
        {
            for (var i = 1; i < this.indents.length; ++i) // pop remaining indent levels
            {
                if (this.callback(Tokenizer.Tokens.T_DEDENT, '', [this.lnum, 0], [this.lnum, 0], '')) return 'done';
            }
            if (this.callback(Tokenizer.Tokens.T_ENDMARKER, '', [this.lnum, 0], [this.lnum, 0], '')) return 'done';

            return 'failed';
        };

    };

    /**
     * @enum {number}
     */
    Tokenizer.Tokens = {
        T_ENDMARKER: 0,
        T_NAME: 1,
        T_NUMBER: 2,
        T_STRING: 3,
        T_NEWLINE: 4,
        T_INDENT: 5,
        T_DEDENT: 6,
        T_LPAR: 7,
        T_RPAR: 8,
        T_LSQB: 9,
        T_RSQB: 10,
        T_COLON: 11,
        T_COMMA: 12,
        T_SEMI: 13,
        T_PLUS: 14,
        T_MINUS: 15,
        T_STAR: 16,
        T_SLASH: 17,
        T_VBAR: 18,
        T_AMPER: 19,
        T_LESS: 20,
        T_GREATER: 21,
        T_EQUAL: 22,
        T_DOT: 23,
        T_PERCENT: 24,
        T_BACKQUOTE: 25,
        T_LBRACE: 26,
        T_RBRACE: 27,
        T_EQEQUAL: 28,
        T_NOTEQUAL: 29,
        T_LESSEQUAL: 30,
        T_GREATEREQUAL: 31,
        T_TILDE: 32,
        T_CIRCUMFLEX: 33,
        T_LEFTSHIFT: 34,
        T_RIGHTSHIFT: 35,
        T_DOUBLESTAR: 36,
        T_PLUSEQUAL: 37,
        T_MINEQUAL: 38,
        T_STAREQUAL: 39,
        T_SLASHEQUAL: 40,
        T_PERCENTEQUAL: 41,
        T_AMPEREQUAL: 42,
        T_VBAREQUAL: 43,
        T_CIRCUMFLEXEQUAL: 44,
        T_LEFTSHIFTEQUAL: 45,
        T_RIGHTSHIFTEQUAL: 46,
        T_DOUBLESTAREQUAL: 47,
        T_DOUBLESLASH: 48,
        T_DOUBLESLASHEQUAL: 49,
        T_AT: 50,
        T_OP: 51,
        T_COMMENT: 52,
        T_NL: 53,
        T_RARROW: 54,
        T_ERRORTOKEN: 55,
        T_N_TOKENS: 56,
        T_NT_OFFSET: 256
    };

    /** @param {...*} x */
    function group(x)
    {
        var args = Array.prototype.slice.call(arguments);
        return '(' + args.join('|') + ')'; 
    }

    /** @param {...*} x */
    function any(x) { return group.apply(null, arguments) + "*"; }

    /** @param {...*} x */
    function maybe(x) { return group.apply(null, arguments) + "?"; }

    /* we have to use string and ctor to be able to build patterns up. + on /.../
     * does something strange. */
    var Whitespace = "[ \\f\\t]*";
    var Comment_ = "#[^\\r\\n]*";
    var Ident = "[a-zA-Z_]\\w*";

    var Binnumber = '0[bB][01]*';
    var Hexnumber = '0[xX][\\da-fA-F]*[lL]?';
    var Octnumber = '0[oO]?[0-7]*[lL]?';
    var Decnumber = '[1-9]\\d*[lL]?';
    var Intnumber = group(Binnumber, Hexnumber, Octnumber, Decnumber);

    var Exponent = "[eE][-+]?\\d+";
    var Pointfloat = group("\\d+\\.\\d*", "\\.\\d+") + maybe(Exponent);
    var Expfloat = '\\d+' + Exponent;
    var Floatnumber = group(Pointfloat, Expfloat);
    var Imagnumber = group("\\d+[jJ]", Floatnumber + "[jJ]");
    var Number_ = group(Imagnumber, Floatnumber, Intnumber);

    // tail end of ' string
    var Single = "^[^'\\\\]*(?:\\\\.[^'\\\\]*)*'";
    // tail end of " string
    var Double_= '^[^"\\\\]*(?:\\\\.[^"\\\\]*)*"';
    // tail end of ''' string
    var Single3 = "[^'\\\\]*(?:(?:\\\\.|'(?!''))[^'\\\\]*)*'''";
    // tail end of """ string
    var Double3 = '[^"\\\\]*(?:(?:\\\\.|"(?!""))[^"\\\\]*)*"""';
    var Triple = group("[ubUB]?[rR]?'''", '[ubUB]?[rR]?"""');
    var String_ = group("[uU]?[rR]?'[^\\n'\\\\]*(?:\\\\.[^\\n'\\\\]*)*'",
            '[uU]?[rR]?"[^\\n"\\\\]*(?:\\\\.[^\\n"\\\\]*)*"');

    // Because of leftmost-then-longest match semantics, be sure to put the
    // longest operators first (e.g., if = came before ==, == would get
    // recognized as two instances of =).
    var Operator = group("\\*\\*=?", ">>=?", "<<=?", "<>", "!=",
                     "//=?", "->",
                     "[+\\-*/%&|^=<>]=?",
                     "~");

    var Bracket = '[\\][(){}]';
    var Special = group('\\r?\\n', '[:;.,`@]');
    var Funny  = group(Operator, Bracket, Special);

    var ContStr = group("[uUbB]?[rR]?'[^\\n'\\\\]*(?:\\\\.[^\\n'\\\\]*)*" +
                    group("'", '\\\\\\r?\\n'),
                    '[uUbB]?[rR]?"[^\\n"\\\\]*(?:\\\\.[^\\n"\\\\]*)*' +
                    group('"', '\\\\\\r?\\n'));
    var PseudoExtras = group('\\\\\\r?\\n', Comment_, Triple);
    // Need to prefix with "^" as we only want to match what's next
    var PseudoToken = "^" + group(PseudoExtras, Number_, Funny, ContStr, Ident);

    var pseudoprog;
    var single3prog;
    var double3prog;
    var endprogs = {};

    var triple_quoted = {
    "'''": true, '"""': true,
    "r'''": true, 'r"""': true, "R'''": true, 'R"""': true,
    "u'''": true, 'u"""': true, "U'''": true, 'U"""': true,
    "b'''": true, 'b"""': true, "B'''": true, 'B"""': true,
    "ur'''": true, 'ur"""': true, "Ur'''": true, 'Ur"""': true,
    "uR'''": true, 'uR"""': true, "UR'''": true, 'UR"""': true,
    "br'''": true, 'br"""': true, "Br'''": true, 'Br"""': true,
    "bR'''": true, 'bR"""': true, "BR'''": true, 'BR"""': true
    };

    var single_quoted = {
    "'": true, '"': true,
    "r'": true, 'r"': true, "R'": true, 'R"': true,
    "u'": true, 'u"': true, "U'": true, 'U"': true,
    "b'": true, 'b"': true, "B'": true, 'B"': true,
    "ur'": true, 'ur"': true, "Ur'": true, 'Ur"': true,
    "uR'": true, 'uR"': true, "UR'": true, 'UR"': true,
    "br'": true, 'br"': true, "Br'": true, 'Br"': true,
    "bR'": true, 'bR"': true, "BR'": true, 'BR"': true
    };

    // hack to make closure keep those objects. not sure what a better way is.
    (function() {
     for (var k in triple_quoted) {}
     for (var k in single_quoted) {}
     }());


    var tabsize = 8;

    function contains(a, obj)
    {
        var i = a.length;
        while (i--)
        {
            if (a[i] === obj)
            {
                return true;
            }
        }
        return false;
    }

    function rstrip(input, what)
    {
        for (var i = input.length; i > 0; --i)
        {
            if (what.indexOf(input.charAt(i - 1)) === -1) break;
        }
        return input.substring(0, i);
    }

    /**
     * @param {string} message
     * @param {string} filename
     * @param {number} begin
     * @param {number} end
     * @param {string|undefined} line
     */
    function tokenError(message, filename, begin, end, line)
    {
        return new Error(message);
    //  return new Sk.builtin.TokenError("EOF in multi-line string", this.filename, this.strstart[0], this.strstart[1], this.contline);
    }

    /**
     * @param {string} message
     * @param {string} filename
     * @param {number} begin
     * @param {number} end
     * @param {string|undefined} line
     */
    function indentationError(message, filename, begin, end, line)
    {
        return new Error(message);
    }

    Tokenizer.prototype.generateTokens = function(line)
    {
        var endmatch, pos, column, end, max;


        // bnm - Move these definitions in this function otherwise test state is preserved between
        // calls on single3prog and double3prog causing weird errors with having multiple instances
        // of triple quoted strings in the same program.

        var pseudoprog = new RegExp(PseudoToken);
        var single3prog = new RegExp(Single3, "g");
        var double3prog = new RegExp(Double3, "g");

        var endprogs = {     "'": new RegExp(Single, "g"), '"': new RegExp(Double_, "g"),
        "'''": single3prog, '"""': double3prog,
        "r'''": single3prog, 'r"""': double3prog,
        "u'''": single3prog, 'u"""': double3prog,
        "b'''": single3prog, 'b"""': double3prog,
        "ur'''": single3prog, 'ur"""': double3prog,
        "br'''": single3prog, 'br"""': double3prog,
        "R'''": single3prog, 'R"""': double3prog,
        "U'''": single3prog, 'U"""': double3prog,
        "B'''": single3prog, 'B"""': double3prog,
        "uR'''": single3prog, 'uR"""': double3prog,
        "Ur'''": single3prog, 'Ur"""': double3prog,
        "UR'''": single3prog, 'UR"""': double3prog,
        "bR'''": single3prog, 'bR"""': double3prog,
        "Br'''": single3prog, 'Br"""': double3prog,
        "BR'''": single3prog, 'BR"""': double3prog,
        'r': null, 'R': null,
        'u': null, 'U': null,
        'b': null, 'B': null
        };



        if (!line) line = '';
        //print("LINE:'"+line+"'");

        this.lnum += 1;
        pos = 0;
        max = line.length;

        if (this.contstr.length > 0)
        {
            if (!line)
            {
                throw tokenError("EOF in multi-line string", this.filename, this.strstart[0], this.strstart[1], this.contline);
            }
            this.endprog.lastIndex = 0;
            endmatch = this.endprog.test(line);
            if (endmatch)
            {
                pos = end = this.endprog.lastIndex;
                if (this.callback(Tokenizer.Tokens.T_STRING, this.contstr + line.substring(0,end),
                            this.strstart, [this.lnum, end], this.contline + line))
                    return 'done';
                this.contstr = '';
                this.needcont = false;
                this.contline = undefined;
            }
            else if (this.needcont && line.substring(line.length - 2) !== "\\\n" && line.substring(line.length - 3) !== "\\\r\n")
            {
                if (this.callback(Tokenizer.Tokens.T_ERRORTOKEN, this.contstr + line,
                            this.strstart, [this.lnum, line.length], this.contline))
                    return 'done';
                this.contstr = '';
                this.contline = undefined;
                return false;
            }
            else
            {
                this.contstr += line;
                this.contline = this.contline + line;
                return false;
            }
        }
        else if (this.parenlev === 0 && !this.continued)
        {
            if (!line) return this.doneFunc();
            column = 0;
            while (pos < max)
            {
                if (line.charAt(pos) === ' ') column += 1;
                else if (line.charAt(pos) === '\t') column = (column/tabsize + 1)*tabsize;
                else if (line.charAt(pos) === '\f') column = 0;
                else break;
                pos = pos + 1;
            }
            if (pos === max) return this.doneFunc();

            if ("#\r\n".indexOf(line.charAt(pos)) !== -1) // skip comments or blank lines
            {
                if (line.charAt(pos) === '#')
                {
                    var comment_token = rstrip(line.substring(pos), '\r\n');
                    var nl_pos = pos + comment_token.length;
                    if (this.callback(Tokenizer.Tokens.T_COMMENT, comment_token,
                                [this.lnum, pos], [this.lnum, pos + comment_token.length], line))
                        return 'done';
                    //print("HERE:1");
                    if (this.callback(Tokenizer.Tokens.T_NL, line.substring(nl_pos),
                                [this.lnum, nl_pos], [this.lnum, line.length], line))
                        return 'done';
                    return false;
                }
                else
                {
                    //print("HERE:2");
                    if (this.callback(Tokenizer.Tokens.T_NL, line.substring(pos),
                                [this.lnum, pos], [this.lnum, line.length], line))
                        return 'done';
                    if (!this.interactive) return false;
                }
            }

            if (column > this.indents[this.indents.length - 1]) // count indents or dedents
            {
                this.indents.push(column);
                if (this.callback(Tokenizer.Tokens.T_INDENT, line.substring(0, pos), [this.lnum, 0], [this.lnum, pos], line))
                    return 'done';
            }
            while (column < this.indents[this.indents.length - 1])
            {
                if (!contains(this.indents, column))
                {
                    throw indentationError("unindent does not match any outer indentation level", this.filename, this.lnum, pos, line);
                }
                this.indents.splice(this.indents.length - 1, 1);
                //print("dedent here");
                if (this.callback(Tokenizer.Tokens.T_DEDENT, '', [this.lnum, pos], [this.lnum, pos], line))
                    return 'done';
            }
        }
        else // continued statement
        {
            if (!line)
            {
                throw tokenError("EOF in multi-line statement", this.filename, this.lnum, 0, line);
            }
            this.continued = false;
        }

        while (pos < max)
        {
            //print("pos:"+pos+":"+max);
            // js regexes don't return any info about matches, other than the
            // content. we'd like to put a \w+ before pseudomatch, but then we
            // can't get any data
            var capos = line.charAt(pos);
            while (capos === ' ' || capos === '\f' || capos === '\t')
            {
                pos += 1;
                capos = line.charAt(pos);
            }
            pseudoprog.lastIndex = 0;
            var pseudomatch = pseudoprog.exec(line.substring(pos));
            if (pseudomatch)
            {
                var start = pos;
                end = start + pseudomatch[1].length;
                var spos = [this.lnum, start];
                var epos = [this.lnum, end];
                pos = end;
                var token = line.substring(start, end);
                var initial = line.charAt(start);
                if (this.numchars.indexOf(initial) !== -1 || (initial === '.' && token !== '.'))
                {
                    if (this.callback(Tokenizer.Tokens.T_NUMBER, token, spos, epos, line)) return 'done';
                }
                else if (initial === '\r' || initial === '\n')
                {
                    var newl = Tokenizer.Tokens.T_NEWLINE;
                    //print("HERE:3");
                    if (this.parenlev > 0) newl = Tokenizer.Tokens.T_NL;
                    if (this.callback(newl, token, spos, epos, line)) return 'done';
                }
                else if (initial === '#')
                {
                    if (this.callback(Tokenizer.Tokens.T_COMMENT, token, spos, epos, line)) return 'done';
                }
                else if (triple_quoted.hasOwnProperty(token))
                {
                    this.endprog = endprogs[token];
                    this.endprog.lastIndex = 0;
                    endmatch = this.endprog.test(line.substring(pos));
                    if (endmatch)
                    {
                        pos = this.endprog.lastIndex + pos;
                        token = line.substring(start, pos);
                        if (this.callback(Tokenizer.Tokens.T_STRING, token, spos, [this.lnum, pos], line)) return 'done';
                    }
                    else
                    {
                        this.strstart = [this.lnum, start];
                        this.contstr = line.substring(start);
                        this.contline = line;
                        return false;
                    }
                }
                else if (single_quoted.hasOwnProperty(initial) ||
                        single_quoted.hasOwnProperty(token.substring(0, 2)) ||
                        single_quoted.hasOwnProperty(token.substring(0, 3)))
                {
                    if (token[token.length - 1] === '\n')
                    {
                        this.strstart = [this.lnum, start];
                        this.endprog = endprogs[initial] || endprogs[token[1]] || endprogs[token[2]];
                        this.contstr = line.substring(start);
                        this.needcont = true;
                        this.contline = line;
                        //print("i, t1, t2", initial, token[1], token[2]);
                        //print("ep, cs", this.endprog, this.contstr);
                        return false;
                    }
                    else
                    {
                        if (this.callback(Tokenizer.Tokens.T_STRING, token, spos, epos, line)) return 'done';
                    }
                }
                else if (this.namechars.indexOf(initial) !== -1)
                {
                    if (this.callback(Tokenizer.Tokens.T_NAME, token, spos, epos, line)) return 'done';
                }
                else if (initial === '\\')
                {
                    //print("HERE:4");
                    if (this.callback(Tokenizer.Tokens.T_NL, token, spos, [this.lnum, pos], line)) return 'done';
                    this.continued = true;
                }
                else
                {
                    if ('([{'.indexOf(initial) !== -1) this.parenlev += 1;
                    else if (')]}'.indexOf(initial) !== -1) this.parenlev -= 1;
                    if (this.callback(Tokenizer.Tokens.T_OP, token, spos, epos, line)) return 'done';
                }
            }
            else
            {
                if (this.callback(Tokenizer.Tokens.T_ERRORTOKEN, line.charAt(pos),
                            [this.lnum, pos], [this.lnum, pos+1], line))
                    return 'done';
                pos += 1;
            }
        }

        return false;
    };

    Tokenizer.tokenNames = {
        0: 'T_ENDMARKER', 1: 'T_NAME', 2: 'T_NUMBER', 3: 'T_STRING', 4: 'T_NEWLINE',
        5: 'T_INDENT', 6: 'T_DEDENT', 7: 'T_LPAR', 8: 'T_RPAR', 9: 'T_LSQB',
        10: 'T_RSQB', 11: 'T_COLON', 12: 'T_COMMA', 13: 'T_SEMI', 14: 'T_PLUS',
        15: 'T_MINUS', 16: 'T_STAR', 17: 'T_SLASH', 18: 'T_VBAR', 19: 'T_AMPER',
        20: 'T_LESS', 21: 'T_GREATER', 22: 'T_EQUAL', 23: 'T_DOT', 24: 'T_PERCENT',
        25: 'T_BACKQUOTE', 26: 'T_LBRACE', 27: 'T_RBRACE', 28: 'T_EQEQUAL', 29: 'T_NOTEQUAL',
        30: 'T_LESSEQUAL', 31: 'T_GREATEREQUAL', 32: 'T_TILDE', 33: 'T_CIRCUMFLEX', 34: 'T_LEFTSHIFT',
        35: 'T_RIGHTSHIFT', 36: 'T_DOUBLESTAR', 37: 'T_PLUSEQUAL', 38: 'T_MINEQUAL', 39: 'T_STAREQUAL',
        40: 'T_SLASHEQUAL', 41: 'T_PERCENTEQUAL', 42: 'T_AMPEREQUAL', 43: 'T_VBAREQUAL', 44: 'T_CIRCUMFLEXEQUAL',
        45: 'T_LEFTSHIFTEQUAL', 46: 'T_RIGHTSHIFTEQUAL', 47: 'T_DOUBLESTAREQUAL', 48: 'T_DOUBLESLASH', 49: 'T_DOUBLESLASHEQUAL',
        50: 'T_AT', 51: 'T_OP', 52: 'T_COMMENT', 53: 'T_NL', 54: 'T_RARROW',
        55: 'T_ERRORTOKEN', 56: 'T_N_TOKENS',
        256: 'T_NT_OFFSET'
    };

    return Tokenizer;
});
// DO NOT MODIFY. generated by pgen/main.py
define('davinci-py/tables',['davinci-py/tokenize'], function(Tokenizer) {
var OpMap = {
"(": Tokenizer.Tokens.T_LPAR,
")": Tokenizer.Tokens.T_RPAR,
"[": Tokenizer.Tokens.T_LSQB,
"]": Tokenizer.Tokens.T_RSQB,
":": Tokenizer.Tokens.T_COLON,
",": Tokenizer.Tokens.T_COMMA,
";": Tokenizer.Tokens.T_SEMI,
"+": Tokenizer.Tokens.T_PLUS,
"-": Tokenizer.Tokens.T_MINUS,
"*": Tokenizer.Tokens.T_STAR,
"/": Tokenizer.Tokens.T_SLASH,
"|": Tokenizer.Tokens.T_VBAR,
"&": Tokenizer.Tokens.T_AMPER,
"<": Tokenizer.Tokens.T_LESS,
">": Tokenizer.Tokens.T_GREATER,
"=": Tokenizer.Tokens.T_EQUAL,
".": Tokenizer.Tokens.T_DOT,
"%": Tokenizer.Tokens.T_PERCENT,
"`": Tokenizer.Tokens.T_BACKQUOTE,
"{": Tokenizer.Tokens.T_LBRACE,
"}": Tokenizer.Tokens.T_RBRACE,
"@": Tokenizer.Tokens.T_AT,
"==": Tokenizer.Tokens.T_EQEQUAL,
"!=": Tokenizer.Tokens.T_NOTEQUAL,
"<>": Tokenizer.Tokens.T_NOTEQUAL,
"<=": Tokenizer.Tokens.T_LESSEQUAL,
">=": Tokenizer.Tokens.T_GREATEREQUAL,
"~": Tokenizer.Tokens.T_TILDE,
"^": Tokenizer.Tokens.T_CIRCUMFLEX,
"<<": Tokenizer.Tokens.T_LEFTSHIFT,
">>": Tokenizer.Tokens.T_RIGHTSHIFT,
"**": Tokenizer.Tokens.T_DOUBLESTAR,
"+=": Tokenizer.Tokens.T_PLUSEQUAL,
"-=": Tokenizer.Tokens.T_MINEQUAL,
"*=": Tokenizer.Tokens.T_STAREQUAL,
"/=": Tokenizer.Tokens.T_SLASHEQUAL,
"%=": Tokenizer.Tokens.T_PERCENTEQUAL,
"&=": Tokenizer.Tokens.T_AMPEREQUAL,
"|=": Tokenizer.Tokens.T_VBAREQUAL,
"^=": Tokenizer.Tokens.T_CIRCUMFLEXEQUAL,
"<<=": Tokenizer.Tokens.T_LEFTSHIFTEQUAL,
">>=": Tokenizer.Tokens.T_RIGHTSHIFTEQUAL,
"**=": Tokenizer.Tokens.T_DOUBLESTAREQUAL,
"//": Tokenizer.Tokens.T_DOUBLESLASH,
"//=": Tokenizer.Tokens.T_DOUBLESLASHEQUAL,
"->": Tokenizer.Tokens.T_RARROW
};
var ParseTables = {
sym:
{and_expr: 257,
 and_test: 258,
 arglist: 259,
 argument: 260,
 arith_expr: 261,
 assert_stmt: 262,
 atom: 263,
 augassign: 264,
 break_stmt: 265,
 classdef: 266,
 comp_op: 267,
 comparison: 268,
 compound_stmt: 269,
 continue_stmt: 270,
 decorated: 271,
 decorator: 272,
 decorators: 273,
 del_stmt: 274,
 dictmaker: 275,
 dotted_as_name: 276,
 dotted_as_names: 277,
 dotted_name: 278,
 encoding_decl: 279,
 eval_input: 280,
 except_clause: 281,
 exec_stmt: 282,
 expr: 283,
 expr_stmt: 284,
 exprlist: 285,
 factor: 286,
 file_input: 287,
 flow_stmt: 288,
 for_stmt: 289,
 fpdef: 290,
 fplist: 291,
 funcdef: 292,
 gen_for: 293,
 gen_if: 294,
 gen_iter: 295,
 global_stmt: 296,
 if_stmt: 297,
 import_as_name: 298,
 import_as_names: 299,
 import_from: 300,
 import_name: 301,
 import_stmt: 302,
 lambdef: 303,
 list_for: 304,
 list_if: 305,
 list_iter: 306,
 listmaker: 307,
 not_test: 308,
 old_lambdef: 309,
 old_test: 310,
 or_test: 311,
 parameters: 312,
 pass_stmt: 313,
 power: 314,
 print_stmt: 315,
 raise_stmt: 316,
 return_stmt: 317,
 shift_expr: 318,
 simple_stmt: 319,
 single_input: 256,
 sliceop: 320,
 small_stmt: 321,
 stmt: 322,
 subscript: 323,
 subscriptlist: 324,
 suite: 325,
 term: 326,
 test: 327,
 testlist: 328,
 testlist1: 329,
 testlist_gexp: 330,
 testlist_safe: 331,
 trailer: 332,
 try_stmt: 333,
 varargslist: 334,
 while_stmt: 335,
 with_stmt: 336,
 with_var: 337,
 xor_expr: 338,
 yield_expr: 339,
 yield_stmt: 340},
number2symbol:
{256: 'single_input',
 257: 'and_expr',
 258: 'and_test',
 259: 'arglist',
 260: 'argument',
 261: 'arith_expr',
 262: 'assert_stmt',
 263: 'atom',
 264: 'augassign',
 265: 'break_stmt',
 266: 'classdef',
 267: 'comp_op',
 268: 'comparison',
 269: 'compound_stmt',
 270: 'continue_stmt',
 271: 'decorated',
 272: 'decorator',
 273: 'decorators',
 274: 'del_stmt',
 275: 'dictmaker',
 276: 'dotted_as_name',
 277: 'dotted_as_names',
 278: 'dotted_name',
 279: 'encoding_decl',
 280: 'eval_input',
 281: 'except_clause',
 282: 'exec_stmt',
 283: 'expr',
 284: 'expr_stmt',
 285: 'exprlist',
 286: 'factor',
 287: 'file_input',
 288: 'flow_stmt',
 289: 'for_stmt',
 290: 'fpdef',
 291: 'fplist',
 292: 'funcdef',
 293: 'gen_for',
 294: 'gen_if',
 295: 'gen_iter',
 296: 'global_stmt',
 297: 'if_stmt',
 298: 'import_as_name',
 299: 'import_as_names',
 300: 'import_from',
 301: 'import_name',
 302: 'import_stmt',
 303: 'lambdef',
 304: 'list_for',
 305: 'list_if',
 306: 'list_iter',
 307: 'listmaker',
 308: 'not_test',
 309: 'old_lambdef',
 310: 'old_test',
 311: 'or_test',
 312: 'parameters',
 313: 'pass_stmt',
 314: 'power',
 315: 'print_stmt',
 316: 'raise_stmt',
 317: 'return_stmt',
 318: 'shift_expr',
 319: 'simple_stmt',
 320: 'sliceop',
 321: 'small_stmt',
 322: 'stmt',
 323: 'subscript',
 324: 'subscriptlist',
 325: 'suite',
 326: 'term',
 327: 'test',
 328: 'testlist',
 329: 'testlist1',
 330: 'testlist_gexp',
 331: 'testlist_safe',
 332: 'trailer',
 333: 'try_stmt',
 334: 'varargslist',
 335: 'while_stmt',
 336: 'with_stmt',
 337: 'with_var',
 338: 'xor_expr',
 339: 'yield_expr',
 340: 'yield_stmt'},
dfas:
{256: [[[[1, 1], [2, 1], [3, 2]], [[0, 1]], [[2, 1]]],
       {2: 1,
        4: 1,
        5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
        10: 1,
        11: 1,
        12: 1,
        13: 1,
        14: 1,
        15: 1,
        16: 1,
        17: 1,
        18: 1,
        19: 1,
        20: 1,
        21: 1,
        22: 1,
        23: 1,
        24: 1,
        25: 1,
        26: 1,
        27: 1,
        28: 1,
        29: 1,
        30: 1,
        31: 1,
        32: 1,
        33: 1,
        34: 1,
        35: 1,
        36: 1}],
 257: [[[[37, 1]], [[38, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 258: [[[[39, 1]], [[40, 0], [0, 1]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1}],
 259: [[[[41, 1], [42, 2], [43, 3]],
        [[44, 4]],
        [[45, 5], [0, 2]],
        [[44, 6]],
        [[45, 7], [0, 4]],
        [[41, 1], [42, 2], [43, 3], [0, 5]],
        [[0, 6]],
        [[42, 4], [43, 3]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1,
        41: 1,
        43: 1}],
 260: [[[[44, 1]], [[46, 2], [47, 3], [0, 1]], [[0, 2]], [[44, 2]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 261: [[[[48, 1]], [[24, 0], [35, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 262: [[[[19, 1]], [[44, 2]], [[45, 3], [0, 2]], [[44, 4]], [[0, 4]]],
       {19: 1}],
 263: [[[[20, 1], [8, 1], [9, 4], [28, 3], [11, 2], [13, 5], [17, 6]],
        [[0, 1]],
        [[49, 7], [50, 1]],
        [[51, 1], [52, 8], [53, 8]],
        [[54, 9], [55, 1]],
        [[56, 10]],
        [[17, 6], [0, 6]],
        [[50, 1]],
        [[51, 1]],
        [[55, 1]],
        [[13, 1]]],
       {8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 28: 1}],
 264: [[[[57, 1],
         [58, 1],
         [59, 1],
         [60, 1],
         [61, 1],
         [62, 1],
         [63, 1],
         [64, 1],
         [65, 1],
         [66, 1],
         [67, 1],
         [68, 1]],
        [[0, 1]]],
       {57: 1,
        58: 1,
        59: 1,
        60: 1,
        61: 1,
        62: 1,
        63: 1,
        64: 1,
        65: 1,
        66: 1,
        67: 1,
        68: 1}],
 265: [[[[31, 1]], [[0, 1]]], {31: 1}],
 266: [[[[10, 1]],
        [[20, 2]],
        [[69, 3], [28, 4]],
        [[70, 5]],
        [[51, 6], [71, 7]],
        [[0, 5]],
        [[69, 3]],
        [[51, 6]]],
       {10: 1}],
 267: [[[[72, 1],
         [73, 1],
         [7, 2],
         [74, 1],
         [72, 1],
         [75, 1],
         [76, 1],
         [77, 3],
         [78, 1],
         [79, 1]],
        [[0, 1]],
        [[75, 1]],
        [[7, 1], [0, 3]]],
       {7: 1, 72: 1, 73: 1, 74: 1, 75: 1, 76: 1, 77: 1, 78: 1, 79: 1}],
 268: [[[[80, 1]], [[81, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 269: [[[[82, 1],
         [83, 1],
         [84, 1],
         [85, 1],
         [86, 1],
         [87, 1],
         [88, 1],
         [89, 1]],
        [[0, 1]]],
       {4: 1, 10: 1, 14: 1, 16: 1, 27: 1, 30: 1, 33: 1, 34: 1}],
 270: [[[[32, 1]], [[0, 1]]], {32: 1}],
 271: [[[[90, 1]], [[88, 2], [85, 2]], [[0, 2]]], {33: 1}],
 272: [[[[33, 1]],
        [[91, 2]],
        [[2, 4], [28, 3]],
        [[51, 5], [92, 6]],
        [[0, 4]],
        [[2, 4]],
        [[51, 5]]],
       {33: 1}],
 273: [[[[93, 1]], [[93, 1], [0, 1]]], {33: 1}],
 274: [[[[21, 1]], [[94, 2]], [[0, 2]]], {21: 1}],
 275: [[[[44, 1]],
        [[69, 2]],
        [[44, 3]],
        [[45, 4], [0, 3]],
        [[44, 1], [0, 4]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 276: [[[[91, 1]], [[95, 2], [0, 1]], [[20, 3]], [[0, 3]]], {20: 1}],
 277: [[[[96, 1]], [[45, 0], [0, 1]]], {20: 1}],
 278: [[[[20, 1]], [[97, 0], [0, 1]]], {20: 1}],
 279: [[[[20, 1]], [[0, 1]]], {20: 1}],
 280: [[[[71, 1]], [[2, 1], [98, 2]], [[0, 2]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 281: [[[[99, 1]],
        [[44, 2], [0, 1]],
        [[95, 3], [45, 3], [0, 2]],
        [[44, 4]],
        [[0, 4]]],
       {99: 1}],
 282: [[[[15, 1]],
        [[80, 2]],
        [[75, 3], [0, 2]],
        [[44, 4]],
        [[45, 5], [0, 4]],
        [[44, 6]],
        [[0, 6]]],
       {15: 1}],
 283: [[[[100, 1]], [[101, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 284: [[[[71, 1]],
        [[102, 2], [47, 3], [0, 1]],
        [[71, 4], [53, 4]],
        [[71, 5], [53, 5]],
        [[0, 4]],
        [[47, 3], [0, 5]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 285: [[[[80, 1]], [[45, 2], [0, 1]], [[80, 1], [0, 2]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 286: [[[[103, 2], [24, 1], [6, 1], [35, 1]], [[104, 2]], [[0, 2]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 287: [[[[2, 0], [98, 1], [105, 0]], [[0, 1]]],
       {2: 1,
        4: 1,
        5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
        10: 1,
        11: 1,
        12: 1,
        13: 1,
        14: 1,
        15: 1,
        16: 1,
        17: 1,
        18: 1,
        19: 1,
        20: 1,
        21: 1,
        22: 1,
        23: 1,
        24: 1,
        25: 1,
        26: 1,
        27: 1,
        28: 1,
        29: 1,
        30: 1,
        31: 1,
        32: 1,
        33: 1,
        34: 1,
        35: 1,
        36: 1,
        98: 1}],
 288: [[[[106, 1], [107, 1], [108, 1], [109, 1], [110, 1]], [[0, 1]]],
       {5: 1, 18: 1, 25: 1, 31: 1, 32: 1}],
 289: [[[[27, 1]],
        [[94, 2]],
        [[75, 3]],
        [[71, 4]],
        [[69, 5]],
        [[70, 6]],
        [[111, 7], [0, 6]],
        [[69, 8]],
        [[70, 9]],
        [[0, 9]]],
       {27: 1}],
 290: [[[[28, 1], [20, 2]], [[112, 3]], [[0, 2]], [[51, 2]]], {20: 1, 28: 1}],
 291: [[[[113, 1]], [[45, 2], [0, 1]], [[113, 1], [0, 2]]], {20: 1, 28: 1}],
 292: [[[[4, 1]], [[20, 2]], [[114, 3]], [[69, 4]], [[70, 5]], [[0, 5]]],
       {4: 1}],
 293: [[[[27, 1]],
        [[94, 2]],
        [[75, 3]],
        [[115, 4]],
        [[116, 5], [0, 4]],
        [[0, 5]]],
       {27: 1}],
 294: [[[[30, 1]], [[117, 2]], [[116, 3], [0, 2]], [[0, 3]]], {30: 1}],
 295: [[[[46, 1], [118, 1]], [[0, 1]]], {27: 1, 30: 1}],
 296: [[[[26, 1]], [[20, 2]], [[45, 1], [0, 2]]], {26: 1}],
 297: [[[[30, 1]],
        [[44, 2]],
        [[69, 3]],
        [[70, 4]],
        [[111, 5], [119, 1], [0, 4]],
        [[69, 6]],
        [[70, 7]],
        [[0, 7]]],
       {30: 1}],
 298: [[[[20, 1]], [[95, 2], [0, 1]], [[20, 3]], [[0, 3]]], {20: 1}],
 299: [[[[120, 1]], [[45, 2], [0, 1]], [[120, 1], [0, 2]]], {20: 1}],
 300: [[[[29, 1]],
        [[91, 2], [97, 3]],
        [[23, 4]],
        [[91, 2], [23, 4], [97, 3]],
        [[121, 5], [41, 5], [28, 6]],
        [[0, 5]],
        [[121, 7]],
        [[51, 5]]],
       {29: 1}],
 301: [[[[23, 1]], [[122, 2]], [[0, 2]]], {23: 1}],
 302: [[[[123, 1], [124, 1]], [[0, 1]]], {23: 1, 29: 1}],
 303: [[[[36, 1]], [[69, 2], [125, 3]], [[44, 4]], [[69, 2]], [[0, 4]]],
       {36: 1}],
 304: [[[[27, 1]],
        [[94, 2]],
        [[75, 3]],
        [[126, 4]],
        [[127, 5], [0, 4]],
        [[0, 5]]],
       {27: 1}],
 305: [[[[30, 1]], [[117, 2]], [[127, 3], [0, 2]], [[0, 3]]], {30: 1}],
 306: [[[[128, 1], [129, 1]], [[0, 1]]], {27: 1, 30: 1}],
 307: [[[[44, 1]],
        [[128, 2], [45, 3], [0, 1]],
        [[0, 2]],
        [[44, 4], [0, 3]],
        [[45, 3], [0, 4]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 308: [[[[7, 1], [130, 2]], [[39, 2]], [[0, 2]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1}],
 309: [[[[36, 1]], [[69, 2], [125, 3]], [[117, 4]], [[69, 2]], [[0, 4]]],
       {36: 1}],
 310: [[[[131, 1], [115, 1]], [[0, 1]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 311: [[[[132, 1]], [[133, 0], [0, 1]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1}],
 312: [[[[28, 1]], [[51, 2], [125, 3]], [[0, 2]], [[51, 2]]], {28: 1}],
 313: [[[[22, 1]], [[0, 1]]], {22: 1}],
 314: [[[[134, 1]], [[135, 1], [43, 2], [0, 1]], [[104, 3]], [[0, 3]]],
       {8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 28: 1}],
 315: [[[[12, 1]],
        [[44, 2], [136, 3], [0, 1]],
        [[45, 4], [0, 2]],
        [[44, 5]],
        [[44, 2], [0, 4]],
        [[45, 6], [0, 5]],
        [[44, 7]],
        [[45, 8], [0, 7]],
        [[44, 7], [0, 8]]],
       {12: 1}],
 316: [[[[5, 1]],
        [[44, 2], [0, 1]],
        [[45, 3], [0, 2]],
        [[44, 4]],
        [[45, 5], [0, 4]],
        [[44, 6]],
        [[0, 6]]],
       {5: 1}],
 317: [[[[18, 1]], [[71, 2], [0, 1]], [[0, 2]]], {18: 1}],
 318: [[[[137, 1]], [[138, 0], [136, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 319: [[[[139, 1]], [[2, 2], [140, 3]], [[0, 2]], [[139, 1], [2, 2]]],
       {5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        12: 1,
        13: 1,
        15: 1,
        17: 1,
        18: 1,
        19: 1,
        20: 1,
        21: 1,
        22: 1,
        23: 1,
        24: 1,
        25: 1,
        26: 1,
        28: 1,
        29: 1,
        31: 1,
        32: 1,
        35: 1,
        36: 1}],
 320: [[[[69, 1]], [[44, 2], [0, 1]], [[0, 2]]], {69: 1}],
 321: [[[[141, 1],
         [142, 1],
         [143, 1],
         [144, 1],
         [145, 1],
         [146, 1],
         [147, 1],
         [148, 1],
         [149, 1]],
        [[0, 1]]],
       {5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        12: 1,
        13: 1,
        15: 1,
        17: 1,
        18: 1,
        19: 1,
        20: 1,
        21: 1,
        22: 1,
        23: 1,
        24: 1,
        25: 1,
        26: 1,
        28: 1,
        29: 1,
        31: 1,
        32: 1,
        35: 1,
        36: 1}],
 322: [[[[1, 1], [3, 1]], [[0, 1]]],
       {4: 1,
        5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
        10: 1,
        11: 1,
        12: 1,
        13: 1,
        14: 1,
        15: 1,
        16: 1,
        17: 1,
        18: 1,
        19: 1,
        20: 1,
        21: 1,
        22: 1,
        23: 1,
        24: 1,
        25: 1,
        26: 1,
        27: 1,
        28: 1,
        29: 1,
        30: 1,
        31: 1,
        32: 1,
        33: 1,
        34: 1,
        35: 1,
        36: 1}],
 323: [[[[44, 1], [69, 2], [97, 3]],
        [[69, 2], [0, 1]],
        [[150, 4], [44, 5], [0, 2]],
        [[97, 6]],
        [[0, 4]],
        [[150, 4], [0, 5]],
        [[97, 4]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1,
        69: 1,
        97: 1}],
 324: [[[[151, 1]], [[45, 2], [0, 1]], [[151, 1], [0, 2]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1,
        69: 1,
        97: 1}],
 325: [[[[1, 1], [2, 2]],
        [[0, 1]],
        [[152, 3]],
        [[105, 4]],
        [[153, 1], [105, 4]]],
       {2: 1,
        5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        12: 1,
        13: 1,
        15: 1,
        17: 1,
        18: 1,
        19: 1,
        20: 1,
        21: 1,
        22: 1,
        23: 1,
        24: 1,
        25: 1,
        26: 1,
        28: 1,
        29: 1,
        31: 1,
        32: 1,
        35: 1,
        36: 1}],
 326: [[[[104, 1]], [[154, 0], [41, 0], [155, 0], [156, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 327: [[[[115, 1], [157, 2]],
        [[30, 3], [0, 1]],
        [[0, 2]],
        [[115, 4]],
        [[111, 5]],
        [[44, 2]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 328: [[[[44, 1]], [[45, 2], [0, 1]], [[44, 1], [0, 2]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 329: [[[[44, 1]], [[45, 0], [0, 1]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 330: [[[[44, 1]],
        [[46, 2], [45, 3], [0, 1]],
        [[0, 2]],
        [[44, 4], [0, 3]],
        [[45, 3], [0, 4]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 331: [[[[117, 1]],
        [[45, 2], [0, 1]],
        [[117, 3]],
        [[45, 4], [0, 3]],
        [[117, 3], [0, 4]]],
       {6: 1,
        7: 1,
        8: 1,
        9: 1,
        11: 1,
        13: 1,
        17: 1,
        20: 1,
        24: 1,
        28: 1,
        35: 1,
        36: 1}],
 332: [[[[28, 1], [97, 2], [11, 3]],
        [[51, 4], [92, 5]],
        [[20, 4]],
        [[158, 6]],
        [[0, 4]],
        [[51, 4]],
        [[50, 4]]],
       {11: 1, 28: 1, 97: 1}],
 333: [[[[14, 1]],
        [[69, 2]],
        [[70, 3]],
        [[159, 4], [160, 5]],
        [[69, 6]],
        [[69, 7]],
        [[70, 8]],
        [[70, 9]],
        [[159, 4], [111, 10], [160, 5], [0, 8]],
        [[0, 9]],
        [[69, 11]],
        [[70, 12]],
        [[160, 5], [0, 12]]],
       {14: 1}],
 334: [[[[41, 1], [113, 2], [43, 3]],
        [[20, 4]],
        [[47, 5], [45, 6], [0, 2]],
        [[20, 7]],
        [[45, 8], [0, 4]],
        [[44, 9]],
        [[41, 1], [113, 2], [43, 3], [0, 6]],
        [[0, 7]],
        [[43, 3]],
        [[45, 6], [0, 9]]],
       {20: 1, 28: 1, 41: 1, 43: 1}],
 335: [[[[16, 1]],
        [[44, 2]],
        [[69, 3]],
        [[70, 4]],
        [[111, 5], [0, 4]],
        [[69, 6]],
        [[70, 7]],
        [[0, 7]]],
       {16: 1}],
 336: [[[[34, 1]],
        [[44, 2]],
        [[69, 3], [161, 4]],
        [[70, 5]],
        [[69, 3]],
        [[0, 5]]],
       {34: 1}],
 337: [[[[95, 1]], [[80, 2]], [[0, 2]]], {95: 1}],
 338: [[[[162, 1]], [[163, 0], [0, 1]]],
       {6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 17: 1, 20: 1, 24: 1, 28: 1, 35: 1}],
 339: [[[[25, 1]], [[71, 2], [0, 1]], [[0, 2]]], {25: 1}],
 340: [[[[53, 1]], [[0, 1]]], {25: 1}]},
states:
[[[[1, 1], [2, 1], [3, 2]], [[0, 1]], [[2, 1]]],
 [[[37, 1]], [[38, 0], [0, 1]]],
 [[[39, 1]], [[40, 0], [0, 1]]],
 [[[41, 1], [42, 2], [43, 3]],
  [[44, 4]],
  [[45, 5], [0, 2]],
  [[44, 6]],
  [[45, 7], [0, 4]],
  [[41, 1], [42, 2], [43, 3], [0, 5]],
  [[0, 6]],
  [[42, 4], [43, 3]]],
 [[[44, 1]], [[46, 2], [47, 3], [0, 1]], [[0, 2]], [[44, 2]]],
 [[[48, 1]], [[24, 0], [35, 0], [0, 1]]],
 [[[19, 1]], [[44, 2]], [[45, 3], [0, 2]], [[44, 4]], [[0, 4]]],
 [[[20, 1], [8, 1], [9, 4], [28, 3], [11, 2], [13, 5], [17, 6]],
  [[0, 1]],
  [[49, 7], [50, 1]],
  [[51, 1], [52, 8], [53, 8]],
  [[54, 9], [55, 1]],
  [[56, 10]],
  [[17, 6], [0, 6]],
  [[50, 1]],
  [[51, 1]],
  [[55, 1]],
  [[13, 1]]],
 [[[57, 1],
   [58, 1],
   [59, 1],
   [60, 1],
   [61, 1],
   [62, 1],
   [63, 1],
   [64, 1],
   [65, 1],
   [66, 1],
   [67, 1],
   [68, 1]],
  [[0, 1]]],
 [[[31, 1]], [[0, 1]]],
 [[[10, 1]],
  [[20, 2]],
  [[69, 3], [28, 4]],
  [[70, 5]],
  [[51, 6], [71, 7]],
  [[0, 5]],
  [[69, 3]],
  [[51, 6]]],
 [[[72, 1],
   [73, 1],
   [7, 2],
   [74, 1],
   [72, 1],
   [75, 1],
   [76, 1],
   [77, 3],
   [78, 1],
   [79, 1]],
  [[0, 1]],
  [[75, 1]],
  [[7, 1], [0, 3]]],
 [[[80, 1]], [[81, 0], [0, 1]]],
 [[[82, 1], [83, 1], [84, 1], [85, 1], [86, 1], [87, 1], [88, 1], [89, 1]],
  [[0, 1]]],
 [[[32, 1]], [[0, 1]]],
 [[[90, 1]], [[88, 2], [85, 2]], [[0, 2]]],
 [[[33, 1]],
  [[91, 2]],
  [[2, 4], [28, 3]],
  [[51, 5], [92, 6]],
  [[0, 4]],
  [[2, 4]],
  [[51, 5]]],
 [[[93, 1]], [[93, 1], [0, 1]]],
 [[[21, 1]], [[94, 2]], [[0, 2]]],
 [[[44, 1]], [[69, 2]], [[44, 3]], [[45, 4], [0, 3]], [[44, 1], [0, 4]]],
 [[[91, 1]], [[95, 2], [0, 1]], [[20, 3]], [[0, 3]]],
 [[[96, 1]], [[45, 0], [0, 1]]],
 [[[20, 1]], [[97, 0], [0, 1]]],
 [[[20, 1]], [[0, 1]]],
 [[[71, 1]], [[2, 1], [98, 2]], [[0, 2]]],
 [[[99, 1]],
  [[44, 2], [0, 1]],
  [[95, 3], [45, 3], [0, 2]],
  [[44, 4]],
  [[0, 4]]],
 [[[15, 1]],
  [[80, 2]],
  [[75, 3], [0, 2]],
  [[44, 4]],
  [[45, 5], [0, 4]],
  [[44, 6]],
  [[0, 6]]],
 [[[100, 1]], [[101, 0], [0, 1]]],
 [[[71, 1]],
  [[102, 2], [47, 3], [0, 1]],
  [[71, 4], [53, 4]],
  [[71, 5], [53, 5]],
  [[0, 4]],
  [[47, 3], [0, 5]]],
 [[[80, 1]], [[45, 2], [0, 1]], [[80, 1], [0, 2]]],
 [[[103, 2], [24, 1], [6, 1], [35, 1]], [[104, 2]], [[0, 2]]],
 [[[2, 0], [98, 1], [105, 0]], [[0, 1]]],
 [[[106, 1], [107, 1], [108, 1], [109, 1], [110, 1]], [[0, 1]]],
 [[[27, 1]],
  [[94, 2]],
  [[75, 3]],
  [[71, 4]],
  [[69, 5]],
  [[70, 6]],
  [[111, 7], [0, 6]],
  [[69, 8]],
  [[70, 9]],
  [[0, 9]]],
 [[[28, 1], [20, 2]], [[112, 3]], [[0, 2]], [[51, 2]]],
 [[[113, 1]], [[45, 2], [0, 1]], [[113, 1], [0, 2]]],
 [[[4, 1]], [[20, 2]], [[114, 3]], [[69, 4]], [[70, 5]], [[0, 5]]],
 [[[27, 1]], [[94, 2]], [[75, 3]], [[115, 4]], [[116, 5], [0, 4]], [[0, 5]]],
 [[[30, 1]], [[117, 2]], [[116, 3], [0, 2]], [[0, 3]]],
 [[[46, 1], [118, 1]], [[0, 1]]],
 [[[26, 1]], [[20, 2]], [[45, 1], [0, 2]]],
 [[[30, 1]],
  [[44, 2]],
  [[69, 3]],
  [[70, 4]],
  [[111, 5], [119, 1], [0, 4]],
  [[69, 6]],
  [[70, 7]],
  [[0, 7]]],
 [[[20, 1]], [[95, 2], [0, 1]], [[20, 3]], [[0, 3]]],
 [[[120, 1]], [[45, 2], [0, 1]], [[120, 1], [0, 2]]],
 [[[29, 1]],
  [[91, 2], [97, 3]],
  [[23, 4]],
  [[91, 2], [23, 4], [97, 3]],
  [[121, 5], [41, 5], [28, 6]],
  [[0, 5]],
  [[121, 7]],
  [[51, 5]]],
 [[[23, 1]], [[122, 2]], [[0, 2]]],
 [[[123, 1], [124, 1]], [[0, 1]]],
 [[[36, 1]], [[69, 2], [125, 3]], [[44, 4]], [[69, 2]], [[0, 4]]],
 [[[27, 1]], [[94, 2]], [[75, 3]], [[126, 4]], [[127, 5], [0, 4]], [[0, 5]]],
 [[[30, 1]], [[117, 2]], [[127, 3], [0, 2]], [[0, 3]]],
 [[[128, 1], [129, 1]], [[0, 1]]],
 [[[44, 1]],
  [[128, 2], [45, 3], [0, 1]],
  [[0, 2]],
  [[44, 4], [0, 3]],
  [[45, 3], [0, 4]]],
 [[[7, 1], [130, 2]], [[39, 2]], [[0, 2]]],
 [[[36, 1]], [[69, 2], [125, 3]], [[117, 4]], [[69, 2]], [[0, 4]]],
 [[[131, 1], [115, 1]], [[0, 1]]],
 [[[132, 1]], [[133, 0], [0, 1]]],
 [[[28, 1]], [[51, 2], [125, 3]], [[0, 2]], [[51, 2]]],
 [[[22, 1]], [[0, 1]]],
 [[[134, 1]], [[135, 1], [43, 2], [0, 1]], [[104, 3]], [[0, 3]]],
 [[[12, 1]],
  [[44, 2], [136, 3], [0, 1]],
  [[45, 4], [0, 2]],
  [[44, 5]],
  [[44, 2], [0, 4]],
  [[45, 6], [0, 5]],
  [[44, 7]],
  [[45, 8], [0, 7]],
  [[44, 7], [0, 8]]],
 [[[5, 1]],
  [[44, 2], [0, 1]],
  [[45, 3], [0, 2]],
  [[44, 4]],
  [[45, 5], [0, 4]],
  [[44, 6]],
  [[0, 6]]],
 [[[18, 1]], [[71, 2], [0, 1]], [[0, 2]]],
 [[[137, 1]], [[138, 0], [136, 0], [0, 1]]],
 [[[139, 1]], [[2, 2], [140, 3]], [[0, 2]], [[139, 1], [2, 2]]],
 [[[69, 1]], [[44, 2], [0, 1]], [[0, 2]]],
 [[[141, 1],
   [142, 1],
   [143, 1],
   [144, 1],
   [145, 1],
   [146, 1],
   [147, 1],
   [148, 1],
   [149, 1]],
  [[0, 1]]],
 [[[1, 1], [3, 1]], [[0, 1]]],
 [[[44, 1], [69, 2], [97, 3]],
  [[69, 2], [0, 1]],
  [[150, 4], [44, 5], [0, 2]],
  [[97, 6]],
  [[0, 4]],
  [[150, 4], [0, 5]],
  [[97, 4]]],
 [[[151, 1]], [[45, 2], [0, 1]], [[151, 1], [0, 2]]],
 [[[1, 1], [2, 2]], [[0, 1]], [[152, 3]], [[105, 4]], [[153, 1], [105, 4]]],
 [[[104, 1]], [[154, 0], [41, 0], [155, 0], [156, 0], [0, 1]]],
 [[[115, 1], [157, 2]],
  [[30, 3], [0, 1]],
  [[0, 2]],
  [[115, 4]],
  [[111, 5]],
  [[44, 2]]],
 [[[44, 1]], [[45, 2], [0, 1]], [[44, 1], [0, 2]]],
 [[[44, 1]], [[45, 0], [0, 1]]],
 [[[44, 1]],
  [[46, 2], [45, 3], [0, 1]],
  [[0, 2]],
  [[44, 4], [0, 3]],
  [[45, 3], [0, 4]]],
 [[[117, 1]],
  [[45, 2], [0, 1]],
  [[117, 3]],
  [[45, 4], [0, 3]],
  [[117, 3], [0, 4]]],
 [[[28, 1], [97, 2], [11, 3]],
  [[51, 4], [92, 5]],
  [[20, 4]],
  [[158, 6]],
  [[0, 4]],
  [[51, 4]],
  [[50, 4]]],
 [[[14, 1]],
  [[69, 2]],
  [[70, 3]],
  [[159, 4], [160, 5]],
  [[69, 6]],
  [[69, 7]],
  [[70, 8]],
  [[70, 9]],
  [[159, 4], [111, 10], [160, 5], [0, 8]],
  [[0, 9]],
  [[69, 11]],
  [[70, 12]],
  [[160, 5], [0, 12]]],
 [[[41, 1], [113, 2], [43, 3]],
  [[20, 4]],
  [[47, 5], [45, 6], [0, 2]],
  [[20, 7]],
  [[45, 8], [0, 4]],
  [[44, 9]],
  [[41, 1], [113, 2], [43, 3], [0, 6]],
  [[0, 7]],
  [[43, 3]],
  [[45, 6], [0, 9]]],
 [[[16, 1]],
  [[44, 2]],
  [[69, 3]],
  [[70, 4]],
  [[111, 5], [0, 4]],
  [[69, 6]],
  [[70, 7]],
  [[0, 7]]],
 [[[34, 1]], [[44, 2]], [[69, 3], [161, 4]], [[70, 5]], [[69, 3]], [[0, 5]]],
 [[[95, 1]], [[80, 2]], [[0, 2]]],
 [[[162, 1]], [[163, 0], [0, 1]]],
 [[[25, 1]], [[71, 2], [0, 1]], [[0, 2]]],
 [[[53, 1]], [[0, 1]]]],
labels:
[[0, 'EMPTY'],
 [319, null],
 [4, null],
 [269, null],
 [1, 'def'],
 [1, 'raise'],
 [32, null],
 [1, 'not'],
 [2, null],
 [26, null],
 [1, 'class'],
 [9, null],
 [1, 'print'],
 [25, null],
 [1, 'try'],
 [1, 'exec'],
 [1, 'while'],
 [3, null],
 [1, 'return'],
 [1, 'assert'],
 [1, null],
 [1, 'del'],
 [1, 'pass'],
 [1, 'import'],
 [15, null],
 [1, 'yield'],
 [1, 'global'],
 [1, 'for'],
 [7, null],
 [1, 'from'],
 [1, 'if'],
 [1, 'break'],
 [1, 'continue'],
 [50, null],
 [1, 'with'],
 [14, null],
 [1, 'lambda'],
 [318, null],
 [19, null],
 [308, null],
 [1, 'and'],
 [16, null],
 [260, null],
 [36, null],
 [327, null],
 [12, null],
 [293, null],
 [22, null],
 [326, null],
 [307, null],
 [10, null],
 [8, null],
 [330, null],
 [339, null],
 [275, null],
 [27, null],
 [329, null],
 [46, null],
 [39, null],
 [41, null],
 [47, null],
 [42, null],
 [43, null],
 [37, null],
 [44, null],
 [49, null],
 [45, null],
 [38, null],
 [40, null],
 [11, null],
 [325, null],
 [328, null],
 [29, null],
 [21, null],
 [28, null],
 [1, 'in'],
 [30, null],
 [1, 'is'],
 [31, null],
 [20, null],
 [283, null],
 [267, null],
 [333, null],
 [297, null],
 [289, null],
 [266, null],
 [336, null],
 [335, null],
 [292, null],
 [271, null],
 [273, null],
 [278, null],
 [259, null],
 [272, null],
 [285, null],
 [1, 'as'],
 [276, null],
 [23, null],
 [0, null],
 [1, 'except'],
 [338, null],
 [18, null],
 [264, null],
 [314, null],
 [286, null],
 [322, null],
 [265, null],
 [270, null],
 [316, null],
 [317, null],
 [340, null],
 [1, 'else'],
 [291, null],
 [290, null],
 [312, null],
 [311, null],
 [295, null],
 [310, null],
 [294, null],
 [1, 'elif'],
 [298, null],
 [299, null],
 [277, null],
 [301, null],
 [300, null],
 [334, null],
 [331, null],
 [306, null],
 [304, null],
 [305, null],
 [268, null],
 [309, null],
 [258, null],
 [1, 'or'],
 [263, null],
 [332, null],
 [35, null],
 [261, null],
 [34, null],
 [321, null],
 [13, null],
 [288, null],
 [262, null],
 [284, null],
 [313, null],
 [315, null],
 [274, null],
 [282, null],
 [296, null],
 [302, null],
 [320, null],
 [323, null],
 [5, null],
 [6, null],
 [48, null],
 [17, null],
 [24, null],
 [303, null],
 [324, null],
 [281, null],
 [1, 'finally'],
 [337, null],
 [257, null],
 [33, null]],
keywords:
{'and': 40,
 'as': 95,
 'assert': 19,
 'break': 31,
 'class': 10,
 'continue': 32,
 'def': 4,
 'del': 21,
 'elif': 119,
 'else': 111,
 'except': 99,
 'exec': 15,
 'finally': 160,
 'for': 27,
 'from': 29,
 'global': 26,
 'if': 30,
 'import': 23,
 'in': 75,
 'is': 77,
 'lambda': 36,
 'not': 7,
 'or': 133,
 'pass': 22,
 'print': 12,
 'raise': 5,
 'return': 18,
 'try': 14,
 'while': 16,
 'with': 34,
 'yield': 25},
tokens:
{0: 98,
 1: 20,
 2: 8,
 3: 17,
 4: 2,
 5: 152,
 6: 153,
 7: 28,
 8: 51,
 9: 11,
 10: 50,
 11: 69,
 12: 45,
 13: 140,
 14: 35,
 15: 24,
 16: 41,
 17: 155,
 18: 101,
 19: 38,
 20: 79,
 21: 73,
 22: 47,
 23: 97,
 24: 156,
 25: 13,
 26: 9,
 27: 55,
 28: 74,
 29: 72,
 30: 76,
 31: 78,
 32: 6,
 33: 163,
 34: 138,
 35: 136,
 36: 43,
 37: 63,
 38: 67,
 39: 58,
 40: 68,
 41: 59,
 42: 61,
 43: 62,
 44: 64,
 45: 66,
 46: 57,
 47: 60,
 48: 154,
 49: 65,
 50: 33},
start: 256
};

var that =
{
  'OpMap': OpMap,
  'ParseTables': ParseTables
};
return that;
});

// Do NOT MODIFY. File automatically generated by asdl_js.py.

define('davinci-py/astnodes',[], function() {
  var that = {
  };

// ----------------------
// operator functions
// ----------------------

function Load() {}
that.Load = Load;
function Store() {}
that.Store = Store;
function Del() {}
that.Del = Del;
function AugLoad() {}
that.AugLoad = AugLoad;
function AugStore() {}
that.AugStore = AugStore;
function Param() {}
that.Param = Param;

function And() {}
that.And = And;
function Or() {}
that.Or = Or;

function Add() {}
that.Add = Add;
function Sub() {}
that.Sub = Sub;
function Mult() {}
that.Mult = Mult;
function Div() {}
that.Div = Div;
function Mod() {}
that.Mod = Mod;
function Pow() {}
that.Pow = Pow;
function LShift() {}
that.LShift = LShift;
function RShift() {}
that.RShift = RShift;
function BitOr() {}
that.BitOr = BitOr;
function BitXor() {}
that.BitXor = BitXor;
function BitAnd() {}
that.BitAnd = BitAnd;
function FloorDiv() {}
that.FloorDiv = FloorDiv;

function Invert() {}
that.Invert = Invert;
function Not() {}
that.Not = Not;
function UAdd() {}
that.UAdd = UAdd;
function USub() {}
that.USub = USub;

function Eq() {}
that.Eq = Eq;
function NotEq() {}
that.NotEq = NotEq;
function Lt() {}
that.Lt = Lt;
function LtE() {}
that.LtE = LtE;
function Gt() {}
that.Gt = Gt;
function GtE() {}
that.GtE = GtE;
function Is() {}
that.Is = Is;
function IsNot() {}
that.IsNot = IsNot;
function In_() {}
that.In_ = In_;
function NotIn() {}
that.NotIn = NotIn;



// ----------------------
// constructors for nodes
// ----------------------

function Module(body)
{
    this.body = body;
    return this;
}
that.Module = Module;

function Interactive(body)
{
    this.body = body;
    return this;
}
that.Interactive = Interactive;

function Expression(body)
{
    this.body = body;
    return this;
}
that.Expression = Expression;

function Suite(body)
{
    this.body = body;
    return this;
}
that.Suite = Suite;

function FunctionDef(name, args, body, decorator_list, lineno, col_offset)
{
    this.name = name;
    this.args = args;
    this.body = body;
    this.decorator_list = decorator_list;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.FunctionDef = FunctionDef;

function ClassDef(name, bases, body, decorator_list, lineno, col_offset)
{
    this.name = name;
    this.bases = bases;
    this.body = body;
    this.decorator_list = decorator_list;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.ClassDef = ClassDef;

function Return_(value, lineno, col_offset)
{
    this.value = value;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Return_ = Return_;

function Delete_(targets, lineno, col_offset)
{
    this.targets = targets;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Delete_ = Delete_;

function Assign(targets, value, lineno, col_offset)
{
    this.targets = targets;
    this.value = value;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Assign = Assign;

function AugAssign(target, op, value, lineno, col_offset)
{
    this.target = target;
    this.op = op;
    this.value = value;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.AugAssign = AugAssign;

function Print(dest, values, nl, lineno, col_offset)
{
    this.dest = dest;
    this.values = values;
    this.nl = nl;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Print = Print;

function For_(target, iter, body, orelse, lineno, col_offset)
{
    this.target = target;
    this.iter = iter;
    this.body = body;
    this.orelse = orelse;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.For_ = For_;

function While_(test, body, orelse, lineno, col_offset)
{
    this.test = test;
    this.body = body;
    this.orelse = orelse;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.While_ = While_;

function If_(test, body, orelse, lineno, col_offset)
{
    this.test = test;
    this.body = body;
    this.orelse = orelse;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.If_ = If_;

function With_(context_expr, optional_vars, body, lineno, col_offset)
{
    this.context_expr = context_expr;
    this.optional_vars = optional_vars;
    this.body = body;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.With_ = With_;

function Raise(type, inst, tback, lineno, col_offset)
{
    this.type = type;
    this.inst = inst;
    this.tback = tback;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Raise = Raise;

function TryExcept(body, handlers, orelse, lineno, col_offset)
{
    this.body = body;
    this.handlers = handlers;
    this.orelse = orelse;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.TryExcept = TryExcept;

function TryFinally(body, finalbody, lineno, col_offset)
{
    this.body = body;
    this.finalbody = finalbody;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.TryFinally = TryFinally;

function Assert(test, msg, lineno, col_offset)
{
    this.test = test;
    this.msg = msg;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Assert = Assert;

function Import_(names, lineno, col_offset)
{
    this.names = names;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Import_ = Import_;

function ImportFrom(module, names, level, lineno, col_offset)
{
    this.module = module;
    this.names = names;
    this.level = level;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.ImportFrom = ImportFrom;

function Exec(body, globals, locals, lineno, col_offset)
{
    this.body = body;
    this.globals = globals;
    this.locals = locals;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Exec = Exec;

function Global(names, lineno, col_offset)
{
    this.names = names;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Global = Global;

function Expr(value, lineno, col_offset)
{
    this.value = value;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Expr = Expr;

function Pass(lineno, col_offset)
{
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Pass = Pass;

function Break_(lineno, col_offset)
{
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Break_ = Break_;

function Continue_(lineno, col_offset)
{
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Continue_ = Continue_;

function BoolOp(op, values, lineno, col_offset)
{
    this.op = op;
    this.values = values;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.BoolOp = BoolOp;

function BinOp(left, op, right, lineno, col_offset)
{
    this.left = left;
    this.op = op;
    this.right = right;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.BinOp = BinOp;

function UnaryOp(op, operand, lineno, col_offset)
{
    this.op = op;
    this.operand = operand;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.UnaryOp = UnaryOp;

function Lambda(args, body, lineno, col_offset)
{
    this.args = args;
    this.body = body;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Lambda = Lambda;

function IfExp(test, body, orelse, lineno, col_offset)
{
    this.test = test;
    this.body = body;
    this.orelse = orelse;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.IfExp = IfExp;

function Dict(keys, values, lineno, col_offset)
{
    this.keys = keys;
    this.values = values;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Dict = Dict;

function ListComp(elt, generators, lineno, col_offset)
{
    this.elt = elt;
    this.generators = generators;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.ListComp = ListComp;

function GeneratorExp(elt, generators, lineno, col_offset)
{
    this.elt = elt;
    this.generators = generators;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.GeneratorExp = GeneratorExp;

function Yield(value, lineno, col_offset)
{
    this.value = value;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Yield = Yield;

function Compare(left, ops, comparators, lineno, col_offset)
{
    this.left = left;
    this.ops = ops;
    this.comparators = comparators;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Compare = Compare;

function Call(func, args, keywords, starargs, kwargs, lineno, col_offset)
{
    this.func = func;
    this.args = args;
    this.keywords = keywords;
    this.starargs = starargs;
    this.kwargs = kwargs;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Call = Call;

function Num(n, lineno, col_offset)
{
    this.n = n;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Num = Num;

function Str(s, lineno, col_offset)
{
    this.s = s;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Str = Str;

function Attribute(value, attr, ctx, lineno, col_offset)
{
    this.value = value;
    this.attr = attr;
    this.ctx = ctx;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Attribute = Attribute;

function Subscript(value, slice, ctx, lineno, col_offset)
{
    this.value = value;
    this.slice = slice;
    this.ctx = ctx;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Subscript = Subscript;

function Name(id, ctx, lineno, col_offset)
{
    this.id = id;
    this.ctx = ctx;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Name = Name;

function List(elts, ctx, lineno, col_offset)
{
    this.elts = elts;
    this.ctx = ctx;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.List = List;

function Tuple(elts, ctx, lineno, col_offset)
{
    this.elts = elts;
    this.ctx = ctx;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.Tuple = Tuple;

function Ellipsis()
{
    return this;
}
that.Ellipsis = Ellipsis;

function Slice(lower, upper, step)
{
    this.lower = lower;
    this.upper = upper;
    this.step = step;
    return this;
}
that.Slice = Slice;

function ExtSlice(dims)
{
    this.dims = dims;
    return this;
}
that.ExtSlice = ExtSlice;

function Index(value)
{
    this.value = value;
    return this;
}
that.Index = Index;

function comprehension(target, iter, ifs)
{
    this.target = target;
    this.iter = iter;
    this.ifs = ifs;
    return this;
}
that.comprehension = comprehension;

function ExceptHandler(type, name, body, lineno, col_offset)
{
    this.type = type;
    this.name = name;
    this.body = body;
    this.lineno = lineno;
    this.col_offset = col_offset;
    return this;
}
that.ExceptHandler = ExceptHandler;

function arguments_(args, vararg, kwarg, defaults)
{
    this.args = args;
    this.vararg = vararg;
    this.kwarg = kwarg;
    this.defaults = defaults;
    return this;
}
that.arguments_ = arguments_;

function keyword(arg, value)
{
    this.arg = arg;
    this.value = value;
    return this;
}
that.keyword = keyword;

function alias(name, asname)
{
    this.name = name;
    this.asname = asname;
    return this;
}
that.alias = alias;


Module.prototype._astname = 'Module';
Module.prototype._fields = [
    'body', function(n) { return n.body; }
];
Interactive.prototype._astname = 'Interactive';
Interactive.prototype._fields = [
    'body', function(n) { return n.body; }
];
Expression.prototype._astname = 'Expression';
Expression.prototype._fields = [
    'body', function(n) { return n.body; }
];
Suite.prototype._astname = 'Suite';
Suite.prototype._fields = [
    'body', function(n) { return n.body; }
];
FunctionDef.prototype._astname = 'FunctionDef';
FunctionDef.prototype._fields = [
    'name', function(n) { return n.name; },
    'args', function(n) { return n.args; },
    'body', function(n) { return n.body; },
    'decorator_list', function(n) { return n.decorator_list; }
];
ClassDef.prototype._astname = 'ClassDef';
ClassDef.prototype._fields = [
    'name', function(n) { return n.name; },
    'bases', function(n) { return n.bases; },
    'body', function(n) { return n.body; },
    'decorator_list', function(n) { return n.decorator_list; }
];
Return_.prototype._astname = 'Return';
Return_.prototype._fields = [
    'value', function(n) { return n.value; }
];
Delete_.prototype._astname = 'Delete';
Delete_.prototype._fields = [
    'targets', function(n) { return n.targets; }
];
Assign.prototype._astname = 'Assign';
Assign.prototype._fields = [
    'targets', function(n) { return n.targets; },
    'value', function(n) { return n.value; }
];
AugAssign.prototype._astname = 'AugAssign';
AugAssign.prototype._fields = [
    'target', function(n) { return n.target; },
    'op', function(n) { return n.op; },
    'value', function(n) { return n.value; }
];
Print.prototype._astname = 'Print';
Print.prototype._fields = [
    'dest', function(n) { return n.dest; },
    'values', function(n) { return n.values; },
    'nl', function(n) { return n.nl; }
];
For_.prototype._astname = 'For';
For_.prototype._fields = [
    'target', function(n) { return n.target; },
    'iter', function(n) { return n.iter; },
    'body', function(n) { return n.body; },
    'orelse', function(n) { return n.orelse; }
];
While_.prototype._astname = 'While';
While_.prototype._fields = [
    'test', function(n) { return n.test; },
    'body', function(n) { return n.body; },
    'orelse', function(n) { return n.orelse; }
];
If_.prototype._astname = 'If';
If_.prototype._fields = [
    'test', function(n) { return n.test; },
    'body', function(n) { return n.body; },
    'orelse', function(n) { return n.orelse; }
];
With_.prototype._astname = 'With';
With_.prototype._fields = [
    'context_expr', function(n) { return n.context_expr; },
    'optional_vars', function(n) { return n.optional_vars; },
    'body', function(n) { return n.body; }
];
Raise.prototype._astname = 'Raise';
Raise.prototype._fields = [
    'type', function(n) { return n.type; },
    'inst', function(n) { return n.inst; },
    'tback', function(n) { return n.tback; }
];
TryExcept.prototype._astname = 'TryExcept';
TryExcept.prototype._fields = [
    'body', function(n) { return n.body; },
    'handlers', function(n) { return n.handlers; },
    'orelse', function(n) { return n.orelse; }
];
TryFinally.prototype._astname = 'TryFinally';
TryFinally.prototype._fields = [
    'body', function(n) { return n.body; },
    'finalbody', function(n) { return n.finalbody; }
];
Assert.prototype._astname = 'Assert';
Assert.prototype._fields = [
    'test', function(n) { return n.test; },
    'msg', function(n) { return n.msg; }
];
Import_.prototype._astname = 'Import';
Import_.prototype._fields = [
    'names', function(n) { return n.names; }
];
ImportFrom.prototype._astname = 'ImportFrom';
ImportFrom.prototype._fields = [
    'module', function(n) { return n.module; },
    'names', function(n) { return n.names; },
    'level', function(n) { return n.level; }
];
Exec.prototype._astname = 'Exec';
Exec.prototype._fields = [
    'body', function(n) { return n.body; },
    'globals', function(n) { return n.globals; },
    'locals', function(n) { return n.locals; }
];
Global.prototype._astname = 'Global';
Global.prototype._fields = [
    'names', function(n) { return n.names; }
];
Expr.prototype._astname = 'Expr';
Expr.prototype._fields = [
    'value', function(n) { return n.value; }
];
Pass.prototype._astname = 'Pass';
Pass.prototype._fields = [
];
Break_.prototype._astname = 'Break';
Break_.prototype._fields = [
];
Continue_.prototype._astname = 'Continue';
Continue_.prototype._fields = [
];
BoolOp.prototype._astname = 'BoolOp';
BoolOp.prototype._fields = [
    'op', function(n) { return n.op; },
    'values', function(n) { return n.values; }
];
BinOp.prototype._astname = 'BinOp';
BinOp.prototype._fields = [
    'left', function(n) { return n.left; },
    'op', function(n) { return n.op; },
    'right', function(n) { return n.right; }
];
UnaryOp.prototype._astname = 'UnaryOp';
UnaryOp.prototype._fields = [
    'op', function(n) { return n.op; },
    'operand', function(n) { return n.operand; }
];
Lambda.prototype._astname = 'Lambda';
Lambda.prototype._fields = [
    'args', function(n) { return n.args; },
    'body', function(n) { return n.body; }
];
IfExp.prototype._astname = 'IfExp';
IfExp.prototype._fields = [
    'test', function(n) { return n.test; },
    'body', function(n) { return n.body; },
    'orelse', function(n) { return n.orelse; }
];
Dict.prototype._astname = 'Dict';
Dict.prototype._fields = [
    'keys', function(n) { return n.keys; },
    'values', function(n) { return n.values; }
];
ListComp.prototype._astname = 'ListComp';
ListComp.prototype._fields = [
    'elt', function(n) { return n.elt; },
    'generators', function(n) { return n.generators; }
];
GeneratorExp.prototype._astname = 'GeneratorExp';
GeneratorExp.prototype._fields = [
    'elt', function(n) { return n.elt; },
    'generators', function(n) { return n.generators; }
];
Yield.prototype._astname = 'Yield';
Yield.prototype._fields = [
    'value', function(n) { return n.value; }
];
Compare.prototype._astname = 'Compare';
Compare.prototype._fields = [
    'left', function(n) { return n.left; },
    'ops', function(n) { return n.ops; },
    'comparators', function(n) { return n.comparators; }
];
Call.prototype._astname = 'Call';
Call.prototype._fields = [
    'func', function(n) { return n.func; },
    'args', function(n) { return n.args; },
    'keywords', function(n) { return n.keywords; },
    'starargs', function(n) { return n.starargs; },
    'kwargs', function(n) { return n.kwargs; }
];
Num.prototype._astname = 'Num';
Num.prototype._fields = [
    'n', function(n) { return n.n; }
];
Str.prototype._astname = 'Str';
Str.prototype._fields = [
    's', function(n) { return n.s; }
];
Attribute.prototype._astname = 'Attribute';
Attribute.prototype._fields = [
    'value', function(n) { return n.value; },
    'attr', function(n) { return n.attr; },
    'ctx', function(n) { return n.ctx; }
];
Subscript.prototype._astname = 'Subscript';
Subscript.prototype._fields = [
    'value', function(n) { return n.value; },
    'slice', function(n) { return n.slice; },
    'ctx', function(n) { return n.ctx; }
];
Name.prototype._astname = 'Name';
Name.prototype._fields = [
    'id', function(n) { return n.id; },
    'ctx', function(n) { return n.ctx; }
];
List.prototype._astname = 'List';
List.prototype._fields = [
    'elts', function(n) { return n.elts; },
    'ctx', function(n) { return n.ctx; }
];
Tuple.prototype._astname = 'Tuple';
Tuple.prototype._fields = [
    'elts', function(n) { return n.elts; },
    'ctx', function(n) { return n.ctx; }
];
Load.prototype._astname = 'Load';
Load.prototype._isenum = true;
Store.prototype._astname = 'Store';
Store.prototype._isenum = true;
Del.prototype._astname = 'Del';
Del.prototype._isenum = true;
AugLoad.prototype._astname = 'AugLoad';
AugLoad.prototype._isenum = true;
AugStore.prototype._astname = 'AugStore';
AugStore.prototype._isenum = true;
Param.prototype._astname = 'Param';
Param.prototype._isenum = true;
Ellipsis.prototype._astname = 'Ellipsis';
Ellipsis.prototype._fields = [
];
Slice.prototype._astname = 'Slice';
Slice.prototype._fields = [
    'lower', function(n) { return n.lower; },
    'upper', function(n) { return n.upper; },
    'step', function(n) { return n.step; }
];
ExtSlice.prototype._astname = 'ExtSlice';
ExtSlice.prototype._fields = [
    'dims', function(n) { return n.dims; }
];
Index.prototype._astname = 'Index';
Index.prototype._fields = [
    'value', function(n) { return n.value; }
];
And.prototype._astname = 'And';
And.prototype._isenum = true;
Or.prototype._astname = 'Or';
Or.prototype._isenum = true;
Add.prototype._astname = 'Add';
Add.prototype._isenum = true;
Sub.prototype._astname = 'Sub';
Sub.prototype._isenum = true;
Mult.prototype._astname = 'Mult';
Mult.prototype._isenum = true;
Div.prototype._astname = 'Div';
Div.prototype._isenum = true;
Mod.prototype._astname = 'Mod';
Mod.prototype._isenum = true;
Pow.prototype._astname = 'Pow';
Pow.prototype._isenum = true;
LShift.prototype._astname = 'LShift';
LShift.prototype._isenum = true;
RShift.prototype._astname = 'RShift';
RShift.prototype._isenum = true;
BitOr.prototype._astname = 'BitOr';
BitOr.prototype._isenum = true;
BitXor.prototype._astname = 'BitXor';
BitXor.prototype._isenum = true;
BitAnd.prototype._astname = 'BitAnd';
BitAnd.prototype._isenum = true;
FloorDiv.prototype._astname = 'FloorDiv';
FloorDiv.prototype._isenum = true;
Invert.prototype._astname = 'Invert';
Invert.prototype._isenum = true;
Not.prototype._astname = 'Not';
Not.prototype._isenum = true;
UAdd.prototype._astname = 'UAdd';
UAdd.prototype._isenum = true;
USub.prototype._astname = 'USub';
USub.prototype._isenum = true;
Eq.prototype._astname = 'Eq';
Eq.prototype._isenum = true;
NotEq.prototype._astname = 'NotEq';
NotEq.prototype._isenum = true;
Lt.prototype._astname = 'Lt';
Lt.prototype._isenum = true;
LtE.prototype._astname = 'LtE';
LtE.prototype._isenum = true;
Gt.prototype._astname = 'Gt';
Gt.prototype._isenum = true;
GtE.prototype._astname = 'GtE';
GtE.prototype._isenum = true;
Is.prototype._astname = 'Is';
Is.prototype._isenum = true;
IsNot.prototype._astname = 'IsNot';
IsNot.prototype._isenum = true;
In_.prototype._astname = 'In';
In_.prototype._isenum = true;
NotIn.prototype._astname = 'NotIn';
NotIn.prototype._isenum = true;
comprehension.prototype._astname = 'comprehension';
comprehension.prototype._fields = [
    'target', function(n) { return n.target; },
    'iter', function(n) { return n.iter; },
    'ifs', function(n) { return n.ifs; }
];
ExceptHandler.prototype._astname = 'ExceptHandler';
ExceptHandler.prototype._fields = [
    'type', function(n) { return n.type; },
    'name', function(n) { return n.name; },
    'body', function(n) { return n.body; }
];
arguments_.prototype._astname = 'arguments';
arguments_.prototype._fields = [
    'args', function(n) { return n.args; },
    'vararg', function(n) { return n.vararg; },
    'kwarg', function(n) { return n.kwarg; },
    'defaults', function(n) { return n.defaults; }
];
keyword.prototype._astname = 'keyword';
keyword.prototype._fields = [
    'arg', function(n) { return n.arg; },
    'value', function(n) { return n.value; }
];
alias.prototype._astname = 'alias';
alias.prototype._fields = [
    'name', function(n) { return n.name; },
    'asname', function(n) { return n.asname; }
];

  return that;
});

define('davinci-py/parser',['davinci-py/tables', 'davinci-py/tokenize', 'davinci-py/asserts'], function(tables, Tokenizer, asserts)
{
    var OpMap = tables.OpMap;
    var ParseTables = tables.ParseTables;
    // low level parser to a concrete syntax tree, derived from cpython's lib2to3

    /**
     * @param {string} message
     * @param {string} filename
     * @param {number=} begin
     * @param {number=} end
     * @param {string=} line
     */
    function parseError(message, filename, begin, end, line)
    {
        return new Error(message);
    }

    /**
     *
     * @constructor
     * @param {Object} grammar
     *
     * p = new Parser(grammar);
     * p.setup([start]);
     * foreach input token:
     *     if p.addtoken(...):
     *         break
     * root = p.rootnode
     *
     * can throw ParseError
     */
    function Parser(filename, grammar)
    {
        this.filename = filename;
        this.grammar = grammar;
        return this;
    }


    Parser.prototype.setup = function(start)
    {
        start = start || this.grammar.start;

        var newnode =
        {
            type: start,
            value: null,
            context: null,
            children: []
        };
        var stackentry =
        {
            dfa: this.grammar.dfas[start],
            state: 0,
            node: newnode
        };
        this.stack = [stackentry];
        this.used_names = {};
    };

    function findInDfa(a, obj)
    {
        var i = a.length;
        while (i--)
        {
            if (a[i][0] === obj[0] && a[i][1] === obj[1])
            {
                return true;
            }
        }
        return false;
    }


    // Add a token; return true if we're done
    Parser.prototype.addtoken = function(type, value, context)
    {
        var ilabel = this.classify(type, value, context);
        //print("ilabel:"+ilabel);

    OUTERWHILE:
        while (true)
        {
            var tp = this.stack[this.stack.length - 1];
            var states = tp.dfa[0];
            var first = tp.dfa[1];
            var arcs = states[tp.state];

            // look for a state with this label
            for (var a = 0; a < arcs.length; ++a)
            {
                var i = arcs[a][0];
                var newstate = arcs[a][1];
                var t = this.grammar.labels[i][0];
                var v = this.grammar.labels[i][1];
                //print("a:"+a+", t:"+t+", i:"+i);
                if (ilabel === i)
                {
                    // look it up in the list of labels
                    asserts.assert(t < 256);
                    // shift a token; we're done with it
                    this.shift(type, value, newstate, context);
                    // pop while we are in an accept-only state
                    var state = newstate;
                    //print("before:"+JSON.stringify(states[state]) + ":state:"+state+":"+JSON.stringify(states[state]));
                    while (states[state].length === 1
                            && states[state][0][0] === 0
                            && states[state][0][1] === state) // states[state] == [(0, state)])
                    {
                        this.pop();
                        //print("in after pop:"+JSON.stringify(states[state]) + ":state:"+state+":"+JSON.stringify(states[state]));
                        if (this.stack.length === 0)
                        {
                            // done!
                            return true;
                        }
                        tp = this.stack[this.stack.length - 1];
                        state = tp.state;
                        states = tp.dfa[0];
                        first = tp.dfa[1];
                        //print(JSON.stringify(states), JSON.stringify(first));
                        //print("bottom:"+JSON.stringify(states[state]) + ":state:"+state+":"+JSON.stringify(states[state]));
                    }
                    // done with this token
                    //print("DONE, return false");
                    return false;
                }
                else if (t >= 256)
                {
                    var itsdfa = this.grammar.dfas[t];
                    var itsfirst = itsdfa[1];
                    if (itsfirst.hasOwnProperty(ilabel))
                    {
                        // push a symbol
                        this.push(t, this.grammar.dfas[t], newstate, context);
                        continue OUTERWHILE;
                    }
                }
            }

            //print("findInDfa: " + JSON.stringify(arcs)+" vs. " + tp.state);
            if (findInDfa(arcs, [0, tp.state]))
            {
                // an accepting state, pop it and try somethign else
                //print("WAA");
                this.pop();
                if (this.stack.length === 0)
                {
                    throw parseError("too much input", this.filename);
                }
            }
            else
            {
                // no transition
                var errline = context[0][0];
                throw parseError("bad input", this.filename, errline, context);
            }
        }
    };

    // turn a token into a label
    Parser.prototype.classify = function(type, value, context)
    {
        var ilabel;
        if (type === Tokenizer.Tokens.T_NAME)
        {
            this.used_names[value] = true;
            ilabel = this.grammar.keywords.hasOwnProperty(value) && this.grammar.keywords[value];
            if (ilabel)
            {
                //print("is keyword");
                return ilabel;
            }
        }
        ilabel = this.grammar.tokens.hasOwnProperty(type) && this.grammar.tokens[type];
        if (!ilabel) {
            // throw parseError("bad token", type, value, context);
            // Questionable modification to put line number in position 2
            // like everywhere else and filename in position 1.
            throw parseError("bad token", this.filename, context[0][0], context);
        }
        return ilabel;
    };

    // shift a token
    Parser.prototype.shift = function(type, value, newstate, context)
    {
        var dfa = this.stack[this.stack.length - 1].dfa;
        var state = this.stack[this.stack.length - 1].state;
        var node = this.stack[this.stack.length - 1].node;
        //print("context", context);
        var newnode = {
            type: type, 
            value: value,
            lineno: context[0][0],         // throwing away end here to match cpython
            col_offset: context[0][1],
            children: null
        };
        if (newnode)
        {
            node.children.push(newnode);
        }
        this.stack[this.stack.length - 1] = {
            dfa: dfa,
            state: newstate,
            node: node
        };
    };

    // push a nonterminal
    Parser.prototype.push = function(type, newdfa, newstate, context)
    {
        var dfa = this.stack[this.stack.length - 1].dfa; 
        var node = this.stack[this.stack.length - 1].node; 
        var newnode = {
            type: type,
            value: null,
            lineno: context[0][0],      // throwing away end here to match cpython
            col_offset: context[0][1],
            children: []
        };
        this.stack[this.stack.length - 1] = {
                dfa: dfa,
                state: newstate,
                node: node
            };
        this.stack.push({
                dfa: newdfa,
                state: 0,
                node: newnode
            });
    };

    //var ac = 0;
    //var bc = 0;

    // pop a nonterminal
    Parser.prototype.pop = function()
    {
        var pop = this.stack.pop();
        var newnode = pop.node;
        //print("POP");
        if (newnode)
        {
            //print("A", ac++, newnode.type);
            //print("stacklen:"+this.stack.length);
            if (this.stack.length !== 0)
            {
                //print("B", bc++);
                var node = this.stack[this.stack.length - 1].node;
                node.children.push(newnode);
            }
            else
            {
                //print("C");
                this.rootnode = newnode;
                this.rootnode.used_names = this.used_names;
            }
        }
    };

    /**
     * parser for interactive input. returns a function that should be called with
     * lines of input as they are entered. the function will return false
     * until the input is complete, when it will return the rootnode of the parse.
     *
     * @param {string} filename
     * @param {string=} style root of parse tree (optional)
     */
    function makeParser(filename, style)
    {
        if (style === undefined) style = "file_input";
        var p = new Parser(filename, ParseTables);
        // for closure's benefit
        if (style === "file_input")
            p.setup(ParseTables.sym.file_input);
        else
            asserts.fail("todo;");
        var curIndex = 0;
        var lineno = 1;
        var column = 0;
        var prefix = "";
        var T_COMMENT = Tokenizer.Tokens.T_COMMENT;
        var T_NL = Tokenizer.Tokens.T_NL;
        var T_OP = Tokenizer.Tokens.T_OP;
        var tokenizer = new Tokenizer(filename, style === "single_input", function(type, value, start, end, line)
                {
                    //print(JSON.stringify([type, value, start, end, line]));
                    var s_lineno = start[0];
                    var s_column = start[1];
                    /*
                    if (s_lineno !== lineno && s_column !== column)
                    {
                        // todo; update prefix and line/col
                    }
                    */
                    if (type === T_COMMENT || type === T_NL)
                    {
                        prefix += value;
                        lineno = end[0];
                        column = end[1];
                        if (value[value.length - 1] === "\n")
                        {
                            lineno += 1;
                            column = 0;
                        }
                        //print("  not calling addtoken");
                        return undefined;
                    }
                    if (type === T_OP)
                    {
                        type = OpMap[value];
                    }
                    if (p.addtoken(type, value, [start, end, line]))
                    {
                        return true;
                    }
                });
        return function(line)
        {
            var ret = tokenizer.generateTokens(line);
            //print("tok:"+ret);
            if (ret)
            {
                if (ret !== "done")
                {
                    throw parseError("incomplete input", this.filename);
                }
                return p.rootnode;
            }
            return false;
        };
    }

    function parse(filename, input)
    {
        var parseFunc = makeParser(filename);
        if (input.substr(input.length - 1, 1) !== "\n") input += "\n";
        //print("input:"+input);
        var lines = input.split("\n");
        var ret;
        for (var i = 0; i < lines.length; ++i)
        {
            ret = parseFunc(lines[i] + ((i === lines.length - 1) ? "" : "\n"));
        }
        return ret;
    };

    function parseTreeDump(n)
    {
        var ret = "";
        if (n.type >= 256) // non-term
        {
            ret += ParseTables.number2symbol[n.type] + "\n";
            for (var i = 0; i < n.children.length; ++i)
            {
                ret += parseTreeDump(n.children[i]);
            }
        }
        else
        {
            ret += Tokenizer.tokenNames[n.type] + ": " + n.value + "\n";
        }
        return ret;
    };

    var that =
    {
        'parse': parse,
        'parseTreeDump': parseTreeDump
    }
    return that;
});
define('davinci-py/numericLiteral',[], function()
{
  /**
   * @param {string} s
   */
  function floatAST(s)
  {
    var thing = {};
    thing.text = s;
    thing.value = parseFloat(s);
    thing.isFloat = function() {return true;};
    thing.isInt = function() {return false;};
    thing.isLong = function() {return false;};
    thing.toString = function() {return s;};
    return thing;
  }

  /**
   * @param {number} n
   */
  function intAST(n)
  {
    var thing = {};
    thing.value = n;
    thing.isFloat = function() {return false;};
    thing.isInt = function() {return true;};
    thing.isLong = function() {return false;};
    thing.toString = function() {return '' + n;};
    return thing;
  }

  /**
   * @param {string} s
   */
  function longAST(s, radix)
  {
    var thing = {};
    thing.text = s;
    thing.radix = radix;
    thing.isFloat = function() {return false;};
    thing.isInt = function() {return false;};
    thing.isLong = function() {return true;};
    thing.toString = function() {return s;};
    return thing;
  }

  var that =
  {
    floatAST: floatAST,
    intAST: intAST,
    longAST: longAST
  };
  return that;
});

define(
    'davinci-py/builder',[
        'davinci-py/tables',
        'davinci-py/tokenize',
        'davinci-py/astnodes',
        'davinci-py/numericLiteral',
        'davinci-py/base',
        'davinci-py/asserts'
    ],
    function(
        tables,
        Tokenizer,
        astnodes,
        numericLiteral,
        base,
        asserts)
{
    //
    // This is pretty much a straight port of ast.c from CPython 2.6.5.
    //
    // The previous version was easier to work with and more JS-ish, but having a
    // somewhat different ast structure than cpython makes testing more difficult.
    //
    // This way, we can use a dump from the ast module on any arbitrary python
    // code and know that we're the same up to ast level, at least.
    //
    var ParseTables = tables.ParseTables;
    var SYM = ParseTables.sym;
    var TOK = Tokenizer.Tokens;

    /**
     * @const
     * @type {number}
     */
    var LONG_THRESHOLD = Math.pow(2, 53);

    /**
     * @param {string} message
     * @param {string} filename
     * @param {number=} begin
     * @param {number=} end
     * @param {string=} line
     */
    function syntaxError(message, filename, begin, end, line)
    {
        return new Error(message);
    }

    /** @constructor */
    function Compiling(encoding, filename)
    {
        this.c_encoding = encoding;
        this.c_filename = filename;
    }

    /**
     * @return {number}
     */
    function NCH(n)
    {
        asserts.assert(n !== undefined);
        if (n.children === null) return 0; return n.children.length;
    }

    function CHILD(n, i)
    {
        asserts.assert(n !== undefined);
        asserts.assert(i !== undefined);
        return n.children[i];
    }

    function REQ(n, type)
    {
        asserts.assert(n.type === type, "node wasn't expected type");
    }

    function strobj(s)
    {
        asserts.assert(typeof s === "string", "expecting string, got " + (typeof s));
        // This previuosly constructed the runtime representation.
        // That may have had an string intern side effect?
        return s;
    }

    /** @return {number} */
    function numStmts(n)
    {
        switch (n.type)
        {
            case SYM.single_input:
                if (CHILD(n, 0).type === TOK.T_NEWLINE)
                    return 0;
                else
                    return numStmts(CHILD(n, 0));
            case SYM.file_input:
                var cnt = 0;
                for (var i = 0; i < NCH(n); ++i)
                {
                    var ch = CHILD(n, i);
                    if (ch.type === SYM.stmt)
                        cnt += numStmts(ch);
                }
                return cnt;
            case SYM.stmt:
                return numStmts(CHILD(n, 0));
            case SYM.compound_stmt:
                return 1;
            case SYM.simple_stmt:
                return Math.floor(NCH(n) / 2); // div 2 is to remove count of ;s
            case SYM.suite:
                if (NCH(n) === 1)
                    return numStmts(CHILD(n, 0));
                else
                {
                     var cnt = 0;
                     for (var i = 2; i < NCH(n) - 1; ++i)
                         cnt += numStmts(CHILD(n, i));
                     return cnt;
                }
            default:
                asserts.fail("Non-statement found");
        }
        return 0;
    }

    function forbiddenCheck(c, n, x, lineno)
    {
        if (x === "None") throw syntaxError("assignment to None", c.c_filename, lineno);
        if (x === "True" || x === "False") throw syntaxError("assignment to True or False is forbidden", c.c_filename, lineno);
    }

    /**
     * Set the context ctx for e, recursively traversing e.
     *
     * Only sets context for expr kinds that can appear in assignment context as
     * per the asdl file.
     */
    function setContext(c, e, ctx, n)
    {
        asserts.assert(ctx !== astnodes.AugStore && ctx !== astnodes.AugLoad);
        var s = null;
        var exprName = null;

        switch (e.constructor)
        {
            case astnodes.Attribute:
            case astnodes.Name:
                if (ctx === astnodes.Store) forbiddenCheck(c, n, e.attr, n.lineno);
                e.ctx = ctx;
                break;
            case astnodes.Subscript:
                e.ctx = ctx;
                break;
            case astnodes.List:
                e.ctx = ctx;
                s = e.elts;
                break;
            case astnodes.Tuple:
                if (e.elts.length === 0)
                    throw syntaxError("can't assign to ()", c.c_filename, n.lineno);
                e.ctx = ctx;
                s = e.elts;
                break;
            case astnodes.Lambda:
                exprName = "lambda";
                break;
            case astnodes.Call:
                exprName = "function call";
                break;
            case astnodes.BoolOp:
            case astnodes.BinOp:
            case astnodes.UnaryOp:
                exprName = "operator";
                break;
            case astnodes.GeneratorExp:
                exprName = "generator expression";
                break;
            case astnodes.Yield:
                exprName = "yield expression";
                break;
            case astnodes.ListComp:
                exprName = "list comprehension";
                break;
            case astnodes.Dict:
            case astnodes.Num:
            case astnodes.Str:
                exprName = "literal";
                break;
            case astnodes.Compare:
                exprName = "comparison";
                break;
            case astnodes.IfExp:
                exprName = "conditional expression";
                break;
            default:
                asserts.fail("unhandled expression in assignment");
        }
        if (exprName)
        {
            throw syntaxError("can't " + (ctx === astnodes.Store ? "assign to" : "delete") + " " + exprName, c.c_filename, n.lineno);
        }

        if (s)
        {
            for (var i = 0; i < s.length; ++i)
            {
                setContext(c, s[i], ctx, n);
            }
        }
    }

    var operatorMap = {};
    (function() {
        operatorMap[TOK.T_VBAR] = astnodes.BitOr;
        operatorMap[TOK.T_VBAR] = astnodes.BitOr;
        operatorMap[TOK.T_CIRCUMFLEX] = astnodes.BitXor;
        operatorMap[TOK.T_AMPER] = astnodes.BitAnd;
        operatorMap[TOK.T_LEFTSHIFT] = astnodes.LShift;
        operatorMap[TOK.T_RIGHTSHIFT] = astnodes.RShift;
        operatorMap[TOK.T_PLUS] = astnodes.Add;
        operatorMap[TOK.T_MINUS] = astnodes.Sub;
        operatorMap[TOK.T_STAR] = astnodes.Mult;
        operatorMap[TOK.T_SLASH] = astnodes.Div;
        operatorMap[TOK.T_DOUBLESLASH] = astnodes.FloorDiv;
        operatorMap[TOK.T_PERCENT] = astnodes.Mod;
    }());
    function getOperator(n)
    {
        asserts.assert(operatorMap[n.type] !== undefined);
        return operatorMap[n.type];
    }

    function astForCompOp(c, n)
    {
        /* comp_op: '<'|'>'|'=='|'>='|'<='|'<>'|'!='|'in'|'not' 'in'|'is'
                   |'is' 'not'
        */
        REQ(n, SYM.comp_op);
        if (NCH(n) === 1)
        {
            n = CHILD(n, 0);
            switch (n.type)
            {
                case TOK.T_LESS: return astnodes.Lt;
                case TOK.T_GREATER: return astnodes.Gt;
                case TOK.T_EQEQUAL: return astnodes.Eq;
                case TOK.T_LESSEQUAL: return astnodes.LtE;
                case TOK.T_GREATEREQUAL: return astnodes.GtE;
                case TOK.T_NOTEQUAL: return astnodes.NotEq;
                case TOK.T_NAME:
                    if (n.value === "in") return astnodes.In_;
                    if (n.value === "is") return astnodes.Is;
            }
        }
        else if (NCH(n) === 2)
        {
            if (CHILD(n, 0).type === TOK.T_NAME)
            {
                if (CHILD(n, 1).value === "in") return astnodes.NotIn;
                if (CHILD(n, 0).value === "is") return astnodes.IsNot;
            }
        }
        asserts.fail("invalid comp_op");
    }

    function seqForTestlist(c, n)
    {
        /* testlist: test (',' test)* [','] */
        asserts.assert(n.type === SYM.testlist ||
                n.type === SYM.listmaker ||
                n.type === SYM.testlist_gexp ||
                n.type === SYM.testlist_safe ||
                n.type === SYM.testlist1);
        var seq = [];
        for (var i = 0; i < NCH(n); i += 2)
        {
            asserts.assert(CHILD(n, i).type === SYM.test || CHILD(n, i).type === SYM.old_test);
            seq[i / 2] = astForExpr(c, CHILD(n, i));
        }
        return seq;
    }

    function astForSuite(c, n)
    {
        /* suite: simple_stmt | NEWLINE INDENT stmt+ DEDENT */
        REQ(n, SYM.suite);
        var seq = [];
        var pos = 0;
        var ch;
        if (CHILD(n, 0).type === SYM.simple_stmt)
        {
            n = CHILD(n, 0);
            /* simple_stmt always ends with an NEWLINE and may have a trailing
             * SEMI. */
            var end = NCH(n) - 1;
            if (CHILD(n, end - 1).type === TOK.T_SEMI)
                end -= 1;
            for (var i = 0; i < end; i += 2) // by 2 to skip ;
                seq[pos++] = astForStmt(c, CHILD(n, i));
        }
        else
        {
            for (var i = 2; i < NCH(n) - 1; ++i)
            {
                ch = CHILD(n, i);
                REQ(ch, SYM.stmt);
                var num = numStmts(ch);
                if (num === 1)
                {
                    // small_stmt or compound_stmt w/ only 1 child
                    seq[pos++] = astForStmt(c, ch);
                }
                else
                {
                    ch = CHILD(ch, 0);
                    REQ(ch, SYM.simple_stmt);
                    for (var j = 0; j < NCH(ch); j += 2)
                    {
                        if (NCH(CHILD(ch, j)) === 0)
                        {
                            asserts.assert(j + 1 === NCH(ch));
                            break;
                        }
                        seq[pos++] = astForStmt(c, CHILD(ch, j));
                    }
                }
            }
        }
        asserts.assert(pos === numStmts(n));
        return seq;
    }

    function astForExceptClause(c, exc, body)
    {
        /* except_clause: 'except' [test [(',' | 'as') test]] */
        REQ(exc, SYM.except_clause);
        REQ(body, SYM.suite);
        if (NCH(exc) === 1)
            return new astnodes.ExceptHandler(null, null, astForSuite(c, body), exc.lineno, exc.col_offset);
        else if (NCH(exc) === 2)
            return new astnodes.ExceptHandler(astForExpr(c, CHILD(exc, 1)), null, astForSuite(c, body), exc.lineno, exc.col_offset);
        else if (NCH(exc) === 4)
        {
            var e = astForExpr(c, CHILD(exc, 3));
            setContext(c, e, astnodes.Store, CHILD(exc, 3));
            return new astnodes.ExceptHandler(astForExpr(c, CHILD(exc, 1)), e, astForSuite(c, body), exc.lineno, exc.col_offset);
        }
        asserts.fail("wrong number of children for except clause");
    }

    function astForTryStmt(c, n)
    {
        var nc = NCH(n);
        var nexcept = (nc - 3) / 3;
        var body, orelse = [], finally_ = null;

        REQ(n, SYM.try_stmt);
        body = astForSuite(c, CHILD(n, 2));
        if (CHILD(n, nc - 3).type === TOK.T_NAME)
        {
            if (CHILD(n, nc - 3).value === "finally")
            {
                if (nc >= 9 && CHILD(n, nc - 6).type === TOK.T_NAME)
                {
                    /* we can assume it's an "else",
                       because nc >= 9 for try-else-finally and
                       it would otherwise have a type of except_clause */
                    orelse = astForSuite(c, CHILD(n, nc - 4));
                    nexcept--;
                }

                finally_ = astForSuite(c, CHILD(n, nc - 1));
                nexcept--;
            }
            else
            {
                /* we can assume it's an "else",
                   otherwise it would have a type of except_clause */
                orelse = astForSuite(c, CHILD(n, nc - 1));
                nexcept--;
            }
        }
        else if (CHILD(n, nc - 3).type !== SYM.except_clause)
        {
            throw syntaxError("malformed 'try' statement", c.c_filename, n.lineno);
        }

        if (nexcept > 0)
        {
            var handlers = [];
            for (var i = 0; i < nexcept; ++i)
                handlers[i] = astForExceptClause(c, CHILD(n, 3 + i * 3), CHILD(n, 5 + i * 3));
            var exceptSt = new astnodes.TryExcept(body, handlers, orelse, n.lineno, n.col_offset);

            if (!finally_)
                return exceptSt;

            /* if a 'finally' is present too, we nest the TryExcept within a
               TryFinally to emulate try ... except ... finally */
            body = [exceptSt];
        }

        asserts.assert(finally_ !== null);
        return new astnodes.TryFinally(body, finally_, n.lineno, n.col_offset);
    }


    function astForDottedName(c, n)
    {
        REQ(n, SYM.dotted_name);
        var lineno = n.lineno;
        var col_offset = n.col_offset;
        var id = strobj(CHILD(n, 0).value);
        var e = new astnodes.Name(id, astnodes.Load, lineno, col_offset);
        for (var i = 2; i < NCH(n); i += 2)
        {
            id = strobj(CHILD(n, i).value);
            e = new astnodes.Attribute(e, id, astnodes.Load, lineno, col_offset);
        }
        return e;
    }

    function astForDecorator(c, n)
    {
        /* decorator: '@' dotted_name [ '(' [arglist] ')' ] NEWLINE */
        REQ(n, SYM.decorator);
        REQ(CHILD(n, 0), TOK.T_AT);
        REQ(CHILD(n, NCH(n) - 1), TOK.T_NEWLINE);
        var nameExpr = astForDottedName(c, CHILD(n, 1));
        var d;
        if (NCH(n) === 3) // no args
            return nameExpr;
        else if (NCH(n) === 5) // call with no args
            return new astnodes.Call(nameExpr, [], [], null, null, n.lineno, n.col_offset);
        else
            return astForCall(c, CHILD(n, 3), nameExpr);
    }

    function astForDecorators(c, n)
    {
        REQ(n, SYM.decorators);
        var decoratorSeq = [];
        for (var i = 0; i < NCH(n); ++i)
            decoratorSeq[i] = astForDecorator(c, CHILD(n, i));
        return decoratorSeq;
    }

    function astForDecorated(c, n)
    {
        REQ(n, SYM.decorated);
        var decoratorSeq = astForDecorators(c, CHILD(n, 0));
        asserts.assert(CHILD(n, 1).type === SYM.funcdef || CHILD(n, 1).type === SYM.classdef);

        var thing = null;
        if (CHILD(n, 1).type === SYM.funcdef)
            thing = astForFuncdef(c, CHILD(n, 1), decoratorSeq);
        else if (CHILD(n, 1) === SYM.classdef)
            thing = astForClassdef(c, CHILD(n, 1), decoratorSeq);
        if (thing)
        {
            thing.lineno = n.lineno;
            thing.col_offset = n.col_offset;
        }
        return thing;
    }

    function astForWithVar(c, n)
    {
        REQ(n, SYM.with_var);
        return astForExpr(c, CHILD(n, 1));
    }

    function astForWithStmt(c, n)
    {
        /* with_stmt: 'with' test [ with_var ] ':' suite */
        var suiteIndex = 3; // skip with, test, :
        asserts.assert(n.type === SYM.with_stmt);
        var contextExpr = astForExpr(c, CHILD(n, 1));
        if (CHILD(n, 2).type === SYM.with_var)
        {
            var optionalVars = astForWithVar(c, CHILD(n, 2));
            setContext(c, optionalVars, astnodes.Store, n);
            suiteIndex = 4;
        }
        return new astnodes.With_(contextExpr, optionalVars, astForSuite(c, CHILD(n, suiteIndex)), n.lineno, n.col_offset);
    }

    function astForExecStmt(c, n)
    {
        var expr1, globals = null, locals = null;
        var nchildren = NCH(n);
        asserts.assert(nchildren === 2 || nchildren === 4 || nchildren === 6);

        /* exec_stmt: 'exec' expr ['in' test [',' test]] */
        REQ(n, SYM.exec_stmt);
        var expr1 = astForExpr(c, CHILD(n, 1));
        if (nchildren >= 4)
            globals = astForExpr(c, CHILD(n, 3));
        if (nchildren === 6)
            locals = astForExpr(c, CHILD(n, 5));
        return new astnodes.Exec(expr1, globals, locals, n.lineno, n.col_offset);
    }

    function astForIfStmt(c, n)
    {
        /* if_stmt: 'if' test ':' suite ('elif' test ':' suite)*
           ['else' ':' suite]
        */
        REQ(n, SYM.if_stmt);
        if (NCH(n) === 4)
            return new astnodes.If_(
                    astForExpr(c, CHILD(n, 1)),
                    astForSuite(c, CHILD(n, 3)),
                    [], n.lineno, n.col_offset);

        var s = CHILD(n, 4).value;
        var decider = s.charAt(2); // elSe or elIf
        if (decider === 's')
        {
            return new astnodes.If_(
                    astForExpr(c, CHILD(n, 1)),
                    astForSuite(c, CHILD(n, 3)),
                    astForSuite(c, CHILD(n, 6)),
                    n.lineno, n.col_offset);
        }
        else if (decider === 'i')
        {
            var nElif = NCH(n) - 4;
            var hasElse = false;
            var orelse = [];
            /* must reference the child nElif+1 since 'else' token is third, not
             * fourth child from the end. */
            if (CHILD(n, nElif + 1).type === TOK.T_NAME && CHILD(n, nElif + 1).value.charAt(2) === 's')
            {
                hasElse = true;
                nElif -= 3;
            }
            nElif /= 4;

            if (hasElse)
            {
                orelse = [
                    new astnodes.If_(
                        astForExpr(c, CHILD(n, NCH(n) - 6)),
                        astForSuite(c, CHILD(n, NCH(n) - 4)),
                        astForSuite(c, CHILD(n, NCH(n) - 1)),
                        CHILD(n, NCH(n) - 6).lineno,
                        CHILD(n, NCH(n) - 6).col_offset)];
                nElif--;
            }

            for (var i = 0; i < nElif; ++i)
            {
                var off = 5 + (nElif - i - 1) * 4;
                orelse = [
                    new astnodes.If_(
                        astForExpr(c, CHILD(n, off)),
                        astForSuite(c, CHILD(n, off + 2)),
                        orelse,
                        CHILD(n, off).lineno,
                        CHILD(n, off).col_offset)];
            }
            return new astnodes.If_(
                    astForExpr(c, CHILD(n, 1)),
                    astForSuite(c, CHILD(n, 3)),
                    orelse, n.lineno, n.col_offset);
        }
        asserts.fail("unexpected token in 'if' statement");
    }

    function astForExprlist(c, n, context)
    {
        REQ(n, SYM.exprlist);
        var seq = [];
        for (var i = 0; i < NCH(n); i += 2)
        {
            var e = astForExpr(c, CHILD(n, i));
            seq[i / 2] = e;
            if (context) setContext(c, e, context, CHILD(n, i));
        }
        return seq;
    }

    function astForDelStmt(c, n)
    {
        /* del_stmt: 'del' exprlist */
        REQ(n, SYM.del_stmt);
        return new astnodes.Delete_(astForExprlist(c, CHILD(n, 1), astnodes.Del), n.lineno, n.col_offset);
    }

    function astForGlobalStmt(c, n)
    {
        /* global_stmt: 'global' NAME (',' NAME)* */
        REQ(n, SYM.global_stmt);
        var s = [];
        for (var i = 1; i < NCH(n); i += 2)
        {
            s[(i - 1) / 2] = strobj(CHILD(n, i).value);
        }
        return new astnodes.Global(s, n.lineno, n.col_offset);
    }

    function astForAssertStmt(c, n)
    {
        /* assert_stmt: 'assert' test [',' test] */
        REQ(n, SYM.assert_stmt);
        if (NCH(n) === 2)
            return new astnodes.Assert(astForExpr(c, CHILD(n, 1)), null, n.lineno, n.col_offset);
        else if (NCH(n) === 4)
            return new astnodes.Assert(astForExpr(c, CHILD(n, 1)), astForExpr(c, CHILD(n, 3)), n.lineno, n.col_offset);
        asserts.fail("improper number of parts to assert stmt");
    }

    function aliasForImportName(c, n)
    {
        /*
          import_as_name: NAME ['as' NAME]
          dotted_as_name: dotted_name ['as' NAME]
          dotted_name: NAME ('.' NAME)*
        */

        loop: while (true) {
            switch (n.type)
            {
                case SYM.import_as_name:
                    var str = null;
                    var name = strobj(CHILD(n, 0).value);
                    if (NCH(n) === 3)
                        str = CHILD(n, 2).value;
                    return new astnodes.alias(name, str == null ? null : strobj(str));
                case SYM.dotted_as_name:
                    if (NCH(n) === 1)
                    {
                        n = CHILD(n, 0);
                        continue loop;
                    }
                    else
                    {
                        var a = aliasForImportName(c, CHILD(n, 0));
                        asserts.assert(!a.asname);
                        a.asname = strobj(CHILD(n, 2).value);
                        return a;
                    }
                case SYM.dotted_name:
                    if (NCH(n) === 1)
                        return new astnodes.alias(strobj(CHILD(n, 0).value), null);
                    else
                    {
                        // create a string of the form a.b.c
                        var str = '';
                        for (var i = 0; i < NCH(n); i += 2)
                            str += CHILD(n, i).value + ".";
                        return new astnodes.alias(strobj(str.substr(0, str.length - 1)), null);
                    }
                case TOK.T_STAR:
                    return new astnodes.alias(strobj("*"), null);
                default:
                    throw syntaxError("unexpected import name", c.c_filename, n.lineno);
            }
        break; }
    }

    function astForImportStmt(c, n)
    {
        /*
          import_stmt: import_name | import_from
          import_name: 'import' dotted_as_names
          import_from: 'from' ('.'* dotted_name | '.') 'import'
                              ('*' | '(' import_as_names ')' | import_as_names)
        */
        REQ(n, SYM.import_stmt);
        var lineno = n.lineno;
        var col_offset = n.col_offset;
        n = CHILD(n, 0);
        if (n.type === SYM.import_name)
        {
            n = CHILD(n, 1);
            REQ(n, SYM.dotted_as_names);
            var aliases = [];
            for (var i = 0; i < NCH(n); i += 2)
                aliases[i / 2] = aliasForImportName(c, CHILD(n, i));
            return new astnodes.Import_(aliases, lineno, col_offset);
        }
        else if (n.type === SYM.import_from)
        {
            var mod = null;
            var ndots = 0;
            var nchildren;

            for (var idx = 1; idx < NCH(n); ++idx)
            {
                if (CHILD(n, idx).type === SYM.dotted_name)
                {
                    mod = aliasForImportName(c, CHILD(n, idx));
                    idx++;
                    break;
                }
                else if (CHILD(n, idx).type !== TOK.T_DOT)
                    break;
                ndots++;
            }
            ++idx; // skip the import keyword
            switch (CHILD(n, idx).type)
            {
                case TOK.T_STAR:
                    // from ... import
                    n = CHILD(n, idx);
                    nchildren = 1;
                    break;
                case TOK.T_LPAR:
                    // from ... import (x, y, z)
                    n = CHILD(n, idx + 1);
                    nchildren = NCH(n);
                    break;
                case SYM.import_as_names:
                    // from ... import x, y, z
                    n = CHILD(n, idx);
                    nchildren = NCH(n);
                    if (nchildren % 2 === 0)
                        throw syntaxError("trailing comma not allowed without surrounding parentheses", c.c_filename, n.lineno);
                    break;
                default:
                    throw syntaxError("Unexpected node-type in from-import", c.c_filename, n.lineno);
            }
            var aliases = [];
            if (n.type === TOK.T_STAR)
                aliases[0] = aliasForImportName(c, n);
            else
                for (var i = 0; i < NCH(n); i += 2)
                    aliases[i / 2] = aliasForImportName(c, CHILD(n, i));
            var modname = mod ? mod.name : "";
            return new astnodes.ImportFrom(strobj(modname), aliases, ndots, lineno, col_offset);
        }
        throw syntaxError("unknown import statement", c.c_filename, n.lineno);
    }

    function astForTestlistGexp(c, n)
    {
        /* testlist_gexp: test ( gen_for | (',' test)* [','] ) */
        /* argument: test [ gen_for ] */
        asserts.assert(n.type === SYM.testlist_gexp || n.type === SYM.argument);
        if (NCH(n) > 1 && CHILD(n, 1).type === SYM.gen_for)
            return astForGenexp(c, n);
        return astForTestlist(c, n);
    }

    function astForListcomp(c, n)
    {
        /* listmaker: test ( list_for | (',' test)* [','] )
           list_for: 'for' exprlist 'in' testlist_safe [list_iter]
           list_iter: list_for | list_if
           list_if: 'if' test [list_iter]
           testlist_safe: test [(',' test)+ [',']]
        */

        function countListFors(c, n)
        {
            var nfors = 0;
            var ch = CHILD(n, 1);
            count_list_for: while (true)
            {
                nfors++;
                REQ(ch, SYM.list_for);
                if (NCH(ch) === 5)
                    ch = CHILD(ch, 4);
                else
                    return nfors;
                count_list_iter: while (true)
                {
                    REQ(ch, SYM.list_iter);
                    ch = CHILD(ch, 0);
                    if (ch.type === SYM.list_for)
                        continue count_list_for;
                    else if (ch.type === SYM.list_if)
                    {
                        if (NCH(ch) === 3)
                        {
                            ch = CHILD(ch, 2);
                            continue count_list_iter;
                        }
                        else
                            return nfors;
                    }
                break;
                }
            break;
            }
        }

        function countListIfs(c, n)
        {
            var nifs = 0;
            while (true)
            {
                REQ(n, SYM.list_iter);
                if (CHILD(n, 0).type === SYM.list_for)
                    return nifs;
                n = CHILD(n, 0);
                REQ(n, SYM.list_if);
                nifs++;
                if (NCH(n) == 2)
                    return nifs;
                n = CHILD(n, 2);
            }
        }

        REQ(n, SYM.listmaker);
        asserts.assert(NCH(n) > 1);
        var elt = astForExpr(c, CHILD(n, 0));
        var nfors = countListFors(c, n);
        var listcomps = [];
        var ch = CHILD(n, 1);
        for (var i = 0; i < nfors; ++i)
        {
            REQ(ch, SYM.list_for);
            var forch = CHILD(ch, 1);
            var t = astForExprlist(c, forch, astnodes.Store);
            var expression = astForTestlist(c, CHILD(ch, 3));
            var lc;
            if (NCH(forch) === 1)
                lc = new astnodes.comprehension(t[0], expression, []);
            else
                lc = new astnodes.comprehension(new astnodes.Tuple(t, astnodes.Store, ch.lineno, ch.col_offset), expression, []);

            if (NCH(ch) === 5)
            {
                ch = CHILD(ch, 4);
                var nifs = countListIfs(c, ch);
                var ifs = [];
                for (var j = 0; j < nifs; ++j)
                {
                    REQ(ch, SYM.list_iter);
                    ch = CHILD(ch, 0);
                    REQ(ch, SYM.list_if);
                    ifs[j] = astForExpr(c, CHILD(ch, 1));
                    if (NCH(ch) === 3)
                        ch = CHILD(ch, 2);
                }
                if (ch.type === SYM.list_iter)
                    ch = CHILD(ch, 0);
                lc.ifs = ifs;
            }
            listcomps[i] = lc;
        }
        return new astnodes.ListComp(elt, listcomps, n.lineno, n.col_offset);
    }

    function astForFactor(c, n)
    {
        /* some random peephole thing that cpy does */
        if (CHILD(n, 0).type === TOK.T_MINUS && NCH(n) === 2)
        {
            var pfactor = CHILD(n, 1);
            if (pfactor.type === SYM.factor && NCH(pfactor) === 1)
            {
                var ppower = CHILD(pfactor, 0);
                if (ppower.type === SYM.power && NCH(ppower) === 1)
                {
                    var patom = CHILD(ppower, 0);
                    if (patom.type === SYM.atom)
                    {
                        var pnum = CHILD(patom, 0);
                        if (pnum.type === TOK.T_NUMBER)
                        {
                            pnum.value = "-" + pnum.value;
                            return astForAtom(c, patom);
                        }
                    }
                }
            }
        }

        var expression = astForExpr(c, CHILD(n, 1));
        switch (CHILD(n, 0).type)
        {
            case TOK.T_PLUS: return new astnodes.UnaryOp(astnodes.UAdd, expression, n.lineno, n.col_offset);
            case TOK.T_MINUS: return new astnodes.UnaryOp(astnodes.USub, expression, n.lineno, n.col_offset);
            case TOK.T_TILDE: return new astnodes.UnaryOp(astnodes.Invert, expression, n.lineno, n.col_offset);
        }

        asserts.fail("unhandled factor");
    }

    function astForForStmt(c, n)
    {
        /* for_stmt: 'for' exprlist 'in' testlist ':' suite ['else' ':' suite] */
        var seq = [];
        REQ(n, SYM.for_stmt);
        if (NCH(n) === 9)
            seq = astForSuite(c, CHILD(n, 8));
        var nodeTarget = CHILD(n, 1);
        var _target = astForExprlist(c, nodeTarget, astnodes.Store);
        var target;
        if (NCH(nodeTarget) === 1)
            target = _target[0];
        else
            target = new astnodes.Tuple(_target, astnodes.Store, n.lineno, n.col_offset);

        return new astnodes.For_(target,
                astForTestlist(c, CHILD(n, 3)),
                astForSuite(c, CHILD(n, 5)),
                seq, n.lineno, n.col_offset);
    }

    function astForCall(c, n, func)
    {
        /*
          arglist: (argument ',')* (argument [',']| '*' test [',' '**' test]
                   | '**' test)
          argument: [test '='] test [gen_for]        # Really [keyword '='] test
        */
        REQ(n, SYM.arglist);
        var nargs = 0;
        var nkeywords = 0;
        var ngens = 0;
        for (var i = 0; i < NCH(n); ++i)
        {
            var ch = CHILD(n, i);
            if (ch.type === SYM.argument)
            {
                if (NCH(ch) === 1) nargs++;
                else if (CHILD(ch, 1).type === SYM.gen_for) ngens++;
                else nkeywords++;
            }
        }
        if (ngens > 1 || (ngens && (nargs || nkeywords)))
            throw syntaxError("Generator expression must be parenthesized if not sole argument", c.c_filename, n.lineno);
        if (nargs + nkeywords + ngens > 255)
            throw syntaxError("more than 255 arguments", c.c_filename, n.lineno);
        var args = [];
        var keywords = [];
        nargs = 0;
        nkeywords = 0;
        var vararg = null;
        var kwarg = null;
        for (var i = 0; i < NCH(n); ++i)
        {
            var ch = CHILD(n, i);
            if (ch.type === SYM.argument)
            {
                if (NCH(ch) === 1)
                {
                    if (nkeywords) throw syntaxError("non-keyword arg after keyword arg", c.c_filename, n.lineno);
                    if (vararg) throw syntaxError("only named arguments may follow *expression", c.c_filename, n.lineno);
                    args[nargs++] = astForExpr(c, CHILD(ch, 0));
                }
                else if (CHILD(ch, 1).type === SYM.gen_for)
                    args[nargs++] = astForGenexp(c, ch);
                else
                {
                    var e = astForExpr(c, CHILD(ch, 0));
                    if (e.constructor === astnodes.Lambda) throw syntaxError("lambda cannot contain assignment", c.c_filename, n.lineno);
                    else if (e.constructor !== astnodes.Name) throw syntaxError("keyword can't be an expression", c.c_filename, n.lineno);
                    var key = e.id;
                    forbiddenCheck(c, CHILD(ch, 0), key, n.lineno);
                    for (var k = 0; k < nkeywords; ++k)
                    {
                        var tmp = keywords[k].arg;
                        if (tmp === key) throw syntaxError("keyword argument repeated", c.c_filename, n.lineno);
                    }
                    keywords[nkeywords++] = new astnodes.keyword(key, astForExpr(c, CHILD(ch, 2)));
                }
            }
            else if (ch.type === TOK.T_STAR)
                vararg = astForExpr(c, CHILD(n, ++i));
            else if (ch.type === TOK.T_DOUBLESTAR)
                kwarg = astForExpr(c, CHILD(n, ++i));
        }
        return new astnodes.Call(func, args, keywords, vararg, kwarg, func.lineno, func.col_offset);
    }

    function astForTrailer(c, n, leftExpr)
    {
        /* trailer: '(' [arglist] ')' | '[' subscriptlist ']' | '.' NAME
           subscriptlist: subscript (',' subscript)* [',']
           subscript: '.' '.' '.' | test | [test] ':' [test] [sliceop]
         */
        REQ(n, SYM.trailer);
        if (CHILD(n, 0).type === TOK.T_LPAR)
        {
            if (NCH(n) === 2)
                return new astnodes.Call(leftExpr, [], [], null, null, n.lineno, n.col_offset);
            else
                return astForCall(c, CHILD(n, 1), leftExpr);
        }
        else if (CHILD(n, 0).type === TOK.T_DOT)
            return new astnodes.Attribute(leftExpr, strobj(CHILD(n, 1).value), astnodes.Load, n.lineno, n.col_offset);
        else
        {
            REQ(CHILD(n, 0), TOK.T_LSQB);
            REQ(CHILD(n, 2), TOK.T_RSQB);
            n = CHILD(n, 1);
            if (NCH(n) === 1)
                return new astnodes.Subscript(leftExpr, astForSlice(c, CHILD(n, 0)), astnodes.Load, n.lineno, n.col_offset);
            else
            {
                /* The grammar is ambiguous here. The ambiguity is resolved
                   by treating the sequence as a tuple literal if there are
                   no slice features.
                */
                var simple = true;
                var slices = [];
                for (var j = 0; j < NCH(n); j += 2)
                {
                    var slc = astForSlice(c, CHILD(n, j));
                    if (slc.constructor !== astnodes.Index)
                        simple = false;
                    slices[j / 2] = slc;
                }
                if (!simple)
                {
                    return new astnodes.Subscript(leftExpr, new astnodes.ExtSlice(slices), astnodes.Load, n.lineno, n.col_offset);
                }
                var elts = [];
                for (var j = 0; j < slices.length; ++j)
                {
                    var slc = slices[j];
                    asserts.assert(slc.constructor === astnodes.Index && slc.value !== null && slc.value !== undefined);
                    elts[j] = slc.value;
                }
                var e = new astnodes.Tuple(elts, astnodes.Load, n.lineno, n.col_offset);
                return new astnodes.Subscript(leftExpr, new astnodes.Index(e), astnodes.Load, n.lineno, n.col_offset);
            }
        }
    }

    function astForFlowStmt(c, n)
    {
        /*
          flow_stmt: break_stmt | continue_stmt | return_stmt | raise_stmt
                     | yield_stmt
          break_stmt: 'break'
          continue_stmt: 'continue'
          return_stmt: 'return' [testlist]
          yield_stmt: yield_expr
          yield_expr: 'yield' testlist
          raise_stmt: 'raise' [test [',' test [',' test]]]
        */
        var ch;
        REQ(n, SYM.flow_stmt);
        ch = CHILD(n, 0);
        switch (ch.type)
        {
            case SYM.break_stmt: return new astnodes.Break_(n.lineno, n.col_offset);
            case SYM.continue_stmt: return new astnodes.Continue_(n.lineno, n.col_offset);
            case SYM.yield_stmt:
                return new astnodes.Expr(astForExpr(c, CHILD(ch, 0)), n.lineno, n.col_offset);
            case SYM.return_stmt:
                if (NCH(ch) === 1)
                    return new astnodes.Return_(null, n.lineno, n.col_offset);
                else
                    return new astnodes.Return_(astForTestlist(c, CHILD(ch, 1)), n.lineno, n.col_offset);
            case SYM.raise_stmt:
                if (NCH(ch) === 1)
                    return new astnodes.Raise(null, null, null, n.lineno, n.col_offset);
                else if (NCH(ch) === 2)
                    return new astnodes.Raise(astForExpr(c, CHILD(ch, 1)), null, null, n.lineno, n.col_offset);
                else if (NCH(ch) === 4)
                    return new astnodes.Raise(
                            astForExpr(c, CHILD(ch, 1)),
                            astForExpr(c, CHILD(ch, 3)),
                            null, n.lineno, n.col_offset);
                else if (NCH(ch) === 6)
                    return new astnodes.Raise(
                            astForExpr(c, CHILD(ch, 1)),
                            astForExpr(c, CHILD(ch, 3)),
                            astForExpr(c, CHILD(ch, 5)),
                            n.lineno, n.col_offset);
            default:
                asserts.fail("unexpected flow_stmt");
        }
        asserts.fail("unhandled flow statement");
    }

    function astForArguments(c, n)
    {
        /* parameters: '(' [varargslist] ')'
           varargslist: (fpdef ['=' test] ',')* ('*' NAME [',' '**' NAME]
                | '**' NAME) | fpdef ['=' test] (',' fpdef ['=' test])* [',']
        */
        var ch;
        var vararg = null;
        var kwarg = null;
        if (n.type === SYM.parameters)
        {
            if (NCH(n) === 2) // () as arglist
                return new astnodes.arguments_([], null, null, []);
            n = CHILD(n, 1);
        }
        REQ(n, SYM.varargslist);

        var args = [];
        var defaults = [];

        /* fpdef: NAME | '(' fplist ')'
           fplist: fpdef (',' fpdef)* [',']
        */
        var foundDefault = false;
        var i = 0;
        var j = 0; // index for defaults
        var k = 0; // index for args
        while (i < NCH(n))
        {
            ch = CHILD(n, i);
            switch (ch.type)
            {
                case SYM.fpdef:
                    var complexArgs = 0;
                    var parenthesized = 0;
                    handle_fpdef: while (true) {
                        if (i + 1 < NCH(n) && CHILD(n, i + 1).type === TOK.T_EQUAL)
                        {
                            defaults[j++] = astForExpr(c, CHILD(n, i + 2));
                            i += 2;
                            foundDefault = true;
                        }
                        else if (foundDefault)
                        {
                            /* def f((x)=4): pass should raise an error.
                               def f((x, (y))): pass will just incur the tuple unpacking warning. */
                            if (parenthesized && !complexArgs)
                                throw syntaxError("parenthesized arg with default", c.c_filename, n.lineno);
                            throw syntaxError("non-default argument follows default argument", c.c_filename, n.lineno);
                        }

                        if (NCH(ch) === 3)
                        {
                            ch = CHILD(ch, 1);
                            // def foo((x)): is not complex, special case.
                            if (NCH(ch) !== 1)
                            {
                                throw syntaxError("tuple parameter unpacking has been removed", c.c_filename, n.lineno);
                            }
                            else
                            {
                                /* def foo((x)): setup for checking NAME below. */
                                /* Loop because there can be many parens and tuple
                                   unpacking mixed in. */
                                parenthesized = true;
                                ch = CHILD(ch, 0);
                                asserts.assert(ch.type === SYM.fpdef);
                                continue handle_fpdef;
                            }
                        }
                        if (CHILD(ch, 0).type === TOK.T_NAME)
                        {
                            forbiddenCheck(c, n, CHILD(ch, 0).value, n.lineno);
                            var id = strobj(CHILD(ch, 0).value);
                            args[k++] = new astnodes.Name(id, astnodes.Param, ch.lineno, ch.col_offset);
                        }
                        i += 2;
                        if (parenthesized)
                            throw syntaxError("parenthesized argument names are invalid", c.c_filename, n.lineno);
                    break; }
                    break;
                case TOK.T_STAR:
                    forbiddenCheck(c, CHILD(n, i + 1), CHILD(n, i + 1).value, n.lineno);
                    vararg = strobj(CHILD(n, i + 1).value);
                    i += 3;
                    break;
                case TOK.T_DOUBLESTAR:
                    forbiddenCheck(c, CHILD(n, i + 1), CHILD(n, i + 1).value, n.lineno);
                    kwarg = strobj(CHILD(n, i + 1).value);
                    i += 3;
                    break;
                default:
                    asserts.fail("unexpected node in varargslist");
            }
        }
        return new astnodes.arguments_(args, vararg, kwarg, defaults);
    }

    function astForFuncdef(c, n, decoratorSeq)
    {
        /* funcdef: 'def' NAME parameters ':' suite */
        REQ(n, SYM.funcdef);
        var name = strobj(CHILD(n, 1).value);
        forbiddenCheck(c, CHILD(n, 1), CHILD(n, 1).value, n.lineno);
        var args = astForArguments(c, CHILD(n, 2));
        var body = astForSuite(c, CHILD(n, 4));
        return new astnodes.FunctionDef(name, args, body, decoratorSeq, n.lineno, n.col_offset);
    }

    function astForClassBases(c, n)
    {
        /* testlist: test (',' test)* [','] */
        asserts.assert(NCH(n) > 0);
        REQ(n, SYM.testlist);
        if (NCH(n) === 1)
            return [astForExpr(c, CHILD(n, 0))];
        return seqForTestlist(c, n);
    }

    function astForClassdef(c, n, decoratorSeq)
    {
        /* classdef: 'class' NAME ['(' testlist ')'] ':' suite */
        REQ(n, SYM.classdef);
        forbiddenCheck(c, n, CHILD(n, 1).value, n.lineno);
        var classname = strobj(CHILD(n, 1).value);
        if (NCH(n) === 4)
            return new astnodes.ClassDef(classname, [], astForSuite(c, CHILD(n, 3)), decoratorSeq, n.lineno, n.col_offset);
        if (CHILD(n, 3).type === TOK.T_RPAR)
            return new astnodes.ClassDef(classname, [], astForSuite(c, CHILD(n, 5)), decoratorSeq, n.lineno, n.col_offset);

        var bases = astForClassBases(c, CHILD(n, 3));
        var s = astForSuite(c, CHILD(n, 6));
        return new astnodes.ClassDef(classname, bases, s, decoratorSeq, n.lineno, n.col_offset);
    }

    function astForLambdef(c, n)
    {
        /* lambdef: 'lambda' [varargslist] ':' test */
        var args;
        var expression;
        if (NCH(n) === 3)
        {
            args = new astnodes.arguments_([], null, null, []);
            expression = astForExpr(c, CHILD(n, 2));
        }
        else
        {
            args = astForArguments(c, CHILD(n, 1));
            expression = astForExpr(c, CHILD(n, 3));
        }
        return new astnodes.Lambda(args, expression, n.lineno, n.col_offset);
    }

    function astForGenexp(c, n)
    {
        /* testlist_gexp: test ( gen_for | (',' test)* [','] )
           argument: [test '='] test [gen_for]       # Really [keyword '='] test */
        asserts.assert(n.type === SYM.testlist_gexp || n.type === SYM.argument);
        asserts.assert(NCH(n) > 1);

        function countGenFors(c, n)
        {
            var nfors = 0;
            var ch = CHILD(n, 1);
            count_gen_for: while (true) {
                nfors++;
                REQ(ch, SYM.gen_for);
                if (NCH(ch) === 5)
                    ch = CHILD(ch, 4);
                else
                    return nfors;
                count_gen_iter: while (true) {
                    REQ(ch, SYM.gen_iter);
                    ch = CHILD(ch, 0);
                    if (ch.type === SYM.gen_for)
                        continue count_gen_for;
                    else if (ch.type === SYM.gen_if)
                    {
                        if (NCH(ch) === 3)
                        {
                            ch = CHILD(ch, 2);
                            continue count_gen_iter;
                        }
                        else
                            return nfors;
                    }
                break; }
            break; }
            asserts.fail("logic error in countGenFors");
        }

        function countGenIfs(c, n)
        {
            var nifs = 0;
            while (true)
            {
                REQ(n, SYM.gen_iter);
                if (CHILD(n, 0).type === SYM.gen_for)
                    return nifs;
                n = CHILD(n, 0);
                REQ(n, SYM.gen_if);
                nifs++;
                if (NCH(n) == 2)
                    return nifs;
                n = CHILD(n, 2);
            }
        }

        var elt = astForExpr(c, CHILD(n, 0));
        var nfors = countGenFors(c, n);
        var genexps = [];
        var ch = CHILD(n, 1);
        for (var i = 0; i < nfors; ++i)
        {
            REQ(ch, SYM.gen_for);
            var forch = CHILD(ch, 1);
            var t = astForExprlist(c, forch, astnodes.Store);
            var expression = astForExpr(c, CHILD(ch, 3));
            var ge;
            if (NCH(forch) === 1)
                ge = new astnodes.comprehension(t[0], expression, []);
            else
                ge = new astnodes.comprehension(new astnodes.Tuple(t, astnodes.Store, ch.lineno, ch.col_offset), expression, []);
            if (NCH(ch) === 5)
            {
                ch = CHILD(ch, 4);
                var nifs = countGenIfs(c, ch);
                var ifs = [];
                for (var j = 0; j < nifs; ++j)
                {
                    REQ(ch, SYM.gen_iter);
                    ch = CHILD(ch, 0);
                    REQ(ch, SYM.gen_if);
                    expression = astForExpr(c, CHILD(ch, 1));
                    ifs[j] = expression;
                    if (NCH(ch) === 3)
                        ch = CHILD(ch, 2);
                }
                if (ch.type === SYM.gen_iter)
                    ch = CHILD(ch, 0);
                ge.ifs = ifs;
            }
            genexps[i] = ge;
        }
        return new astnodes.GeneratorExp(elt, genexps, n.lineno, n.col_offset);
    }

    function astForWhileStmt(c, n)
    {
        /* while_stmt: 'while' test ':' suite ['else' ':' suite] */
        REQ(n, SYM.while_stmt);
        if (NCH(n) === 4)
            return new astnodes.While_(astForExpr(c, CHILD(n, 1)), astForSuite(c, CHILD(n, 3)), [], n.lineno, n.col_offset);
        else if (NCH(n) === 7)
            return new astnodes.While_(astForExpr(c, CHILD(n, 1)), astForSuite(c, CHILD(n, 3)), astForSuite(c, CHILD(n, 6)), n.lineno, n.col_offset);
        asserts.fail("wrong number of tokens for 'while' stmt");
    }

    function astForAugassign(c, n)
    {
        REQ(n, SYM.augassign);
        n = CHILD(n, 0);
        switch (n.value.charAt(0))
        {
            case '+': return astnodes.Add;
            case '-': return astnodes.Sub;
            case '/': if (n.value.charAt(1) === '/') return astnodes.FloorDiv;
                      return astnodes.Div;
            case '%': return astnodes.Mod;
            case '<': return astnodes.LShift;
            case '>': return astnodes.RShift;
            case '&': return astnodes.BitAnd;
            case '^': return astnodes.BitXor;
            case '|': return astnodes.BitOr;
            case '*': if (n.value.charAt(1) === '*') return astnodes.Pow;
                      return astnodes.Mult;
            default: asserts.fail("invalid augassign");
        }
    }

    function astForBinop(c, n)
    {
        /* Must account for a sequence of expressions.
            How should A op B op C by represented?
            BinOp(BinOp(A, op, B), op, C).
        */
        var result = new astnodes.BinOp(
                astForExpr(c, CHILD(n, 0)),
                getOperator(CHILD(n, 1)),
                astForExpr(c, CHILD(n, 2)),
                n.lineno, n.col_offset);
        var nops = (NCH(n) - 1) / 2;
        for (var i = 1; i < nops; ++i)
        {
            var nextOper = CHILD(n, i * 2 + 1);
            var newoperator = getOperator(nextOper);
            var tmp = astForExpr(c, CHILD(n, i * 2 + 2));
            result = new astnodes.BinOp(result, newoperator, tmp, nextOper.lineno, nextOper.col_offset);
        }
        return result;

    }

    function astForTestlist(c, n)
    {
        /* testlist_gexp: test (',' test)* [','] */
        /* testlist: test (',' test)* [','] */
        /* testlist_safe: test (',' test)+ [','] */
        /* testlist1: test (',' test)* */
        asserts.assert(NCH(n) > 0);
        if (n.type === SYM.testlist_gexp)
        {
            if (NCH(n) > 1)
            {
                asserts.assert(CHILD(n, 1).type !== SYM.gen_for);
            }
        }
        else
        {
            asserts.assert(n.type === SYM.testlist || n.type === SYM.testlist_safe || n.type === SYM.testlist1);
        }

        if (NCH(n) === 1)
        {
            return astForExpr(c, CHILD(n, 0));
        }
        else
        {
            return new astnodes.Tuple(seqForTestlist(c, n), astnodes.Load, n.lineno, n.col_offset);
        }

    }

    function astForExprStmt(c, n)
    {
        REQ(n, SYM.expr_stmt);
        /* expr_stmt: testlist (augassign (yield_expr|testlist)
                    | ('=' (yield_expr|testlist))*)
           testlist: test (',' test)* [',']
           augassign: '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^='
                    | '<<=' | '>>=' | '**=' | '//='
           test: ... here starts the operator precendence dance
         */
        if (NCH(n) === 1)
            return new astnodes.Expr(astForTestlist(c, CHILD(n, 0)), n.lineno, n.col_offset);
        else if (CHILD(n, 1).type === SYM.augassign)
        {
            var ch = CHILD(n, 0);
            var expr1 = astForTestlist(c, ch);
            switch (expr1.constructor)
            {
                case astnodes.GeneratorExp: throw syntaxError("augmented assignment to generator expression not possible", c.c_filename, n.lineno);
                case astnodes.Yield: throw syntaxError("augmented assignment to yield expression not possible", c.c_filename, n.lineno);
                case astnodes.Name:
                    var varName = expr1.id;
                    forbiddenCheck(c, ch, varName, n.lineno);
                    break;
                case astnodes.Attribute:
                case astnodes.Subscript:
                    break;
                default:
                    throw syntaxError("illegal expression for augmented assignment", c.c_filename, n.lineno);
            }
            setContext(c, expr1, astnodes.Store, ch);

            ch = CHILD(n, 2);
            var expr2;
            if (ch.type === SYM.testlist)
                expr2 = astForTestlist(c, ch);
            else
                expr2 = astForExpr(c, ch);

            return new astnodes.AugAssign(expr1, astForAugassign(c, CHILD(n, 1)), expr2, n.lineno, n.col_offset);
        }
        else
        {
            // normal assignment
            REQ(CHILD(n, 1), TOK.T_EQUAL);
            var targets = [];
            for (var i = 0; i < NCH(n) - 2; i += 2)
            {
                var ch = CHILD(n, i);
                if (ch.type === SYM.yield_expr) throw syntaxError("assignment to yield expression not possible", c.c_filename, n.lineno);
                var e = astForTestlist(c, ch);
                setContext(c, e, astnodes.Store, CHILD(n, i));
                targets[i / 2] = e;
            }
            var value = CHILD(n, NCH(n) - 1);
            var expression;
            if (value.type === SYM.testlist)
                expression = astForTestlist(c, value);
            else
                expression = astForExpr(c, value);
            return new astnodes.Assign(targets, expression, n.lineno, n.col_offset);
        }
    }

    function astForIfexpr(c, n)
    {
        /* test: or_test 'if' or_test 'else' test */
        asserts.assert(NCH(n) === 5);
        return new astnodes.IfExp(
                astForExpr(c, CHILD(n, 2)),
                astForExpr(c, CHILD(n, 0)),
                astForExpr(c, CHILD(n, 4)),
                n.lineno, n.col_offset);
    }

    /**
     * s is a python-style string literal, including quote characters and u/r/b
     * prefixes. Returns decoded string object.
     */
    function parsestr(c, s)
    {
        var encodeUtf8 = function(s) { return unescape(encodeURIComponent(s)); };
        var decodeUtf8 = function(s) { return decodeURIComponent(escape(s)); };
        var decodeEscape = function(s, quote)
        {
            var len = s.length;
            var ret = '';
            for (var i = 0; i < len; ++i)
            {
                var c = s.charAt(i);
                if (c === '\\')
                {
                    ++i;
                    c = s.charAt(i);
                    if (c === 'n') ret += "\n";
                    else if (c === '\\') ret += "\\";
                    else if (c === 't') ret += "\t";
                    else if (c === 'r') ret += "\r";
                    else if (c === 'b') ret += "\b";
                    else if (c === 'f') ret += "\f";
                    else if (c === 'v') ret += "\v";
                    else if (c === '0') ret += "\0";
                    else if (c === '"') ret += '"';
                    else if (c === '\'') ret += '\'';
                    else if (c === '\n') /* escaped newline, join lines */ {}
                    else if (c === 'x')
                    {
                        var d0 = s.charAt(++i);
                        var d1 = s.charAt(++i);
                        ret += String.fromCharCode(parseInt(d0 + d1, 16));
                    }
                    else if (c === 'u' || c === 'U')
                    {
                        var d0 = s.charAt(++i);
                        var d1 = s.charAt(++i);
                        var d2 = s.charAt(++i);
                        var d3 = s.charAt(++i);
                        ret += String.fromCharCode(parseInt(d0 + d1, 16), parseInt(d2 + d3, 16));
                    }
                    else
                    {
                        // Leave it alone
                        ret += "\\" + c;
                    }
                }
                else
                {
                    ret += c;
                }
            }
            return ret;
        };

        var quote = s.charAt(0);
        var rawmode = false;

        if (quote === 'u' || quote === 'U')
        {
            s = s.substr(1);
            quote = s.charAt(0);
        }
        else if (quote === 'r' || quote === 'R')
        {
            s = s.substr(1);
            quote = s.charAt(0);
            rawmode = true;
        }
        asserts.assert(quote !== 'b' && quote !== 'B', "todo; haven't done b'' strings yet");

        asserts.assert(quote === "'" || quote === '"' && s.charAt(s.length - 1) === quote);
        s = s.substr(1, s.length - 2);

        if (s.length >= 4 && s.charAt(0) === quote && s.charAt(1) === quote)
        {
            asserts.assert(s.charAt(s.length - 1) === quote && s.charAt(s.length - 2) === quote);
            s = s.substr(2, s.length - 4);
        }

        if (rawmode || s.indexOf('\\') === -1)
        {
            return strobj(decodeUtf8(s));
        }
        return strobj(decodeEscape(s, quote));
    }

    /**
     * @return {string}
     */
    function parsestrplus(c, n)
    {
        REQ(CHILD(n, 0), TOK.T_STRING);
        var ret = "";
        for (var i = 0; i < NCH(n); ++i)
        {
            var child = CHILD(n, i);
            try
            {
                ret = ret + parsestr(c, child.value);
            }
            catch (x)
            {
                throw syntaxError("invalid string (possibly contains a unicode character)", c.c_filename, child.lineno);
            }
        }
        return ret;
    }

    function parsenumber(c, s, lineno)
    {
        var end = s.charAt(s.length - 1);

        if (end === 'j' || end === 'J')
        {
            throw syntaxError("complex numbers are currently unsupported", c.c_filename, lineno);
        }

        if (s.indexOf('.') !== -1)
        {
            return numericLiteral.floatAST(s);
        }

        // Handle integers of various bases
        var tmp = s;
        var value;
        var radix = 10;
        var neg = false;
        if (s.charAt(0) === '-')
        {
            tmp = s.substr(1);
            neg = true;
        }

        if (tmp.charAt(0) === '0' && (tmp.charAt(1) === 'x' || tmp.charAt(1) === 'X'))
        {
            // Hex
            tmp = tmp.substring(2);
            value = parseInt(tmp, 16);
            radix = 16;
        }
        else if ((s.indexOf('e') !== -1) || (s.indexOf('E') !== -1))
        {
            // Float with exponent (needed to make sure e/E wasn't hex first)
            return numericLiteral.floatAST(s);
        }
        else if (tmp.charAt(0) === '0' && (tmp.charAt(1) === 'b' || tmp.charAt(1) === 'B'))
        {
            // Binary
            tmp = tmp.substring(2);
            value = parseInt(tmp, 2);
            radix = 2;
        }
        else if (tmp.charAt(0) === '0')
        {
            if (tmp === "0")
            {
                // Zero
                value = 0;
            }
            else
            {
                // Octal (Leading zero, but not actually zero)
                if (end === 'l' || end === 'L')
                {
                    return numericLiteral.longAST(s.substr(0, s.length - 1), 8);
                }
                else
                {
                    radix = 8;
                    tmp = tmp.substring(1);
                    if ((tmp.charAt(0) === 'o') || (tmp.charAt(0) === 'O'))
                    {
                        tmp = tmp.substring(1);
                    }
                    value = parseInt(tmp, 8);
                }
            }
        }
        else
        {
            // Decimal
            if (end === 'l' || end === 'L')
            {
                return numericLiteral.longAST(s.substr(0, s.length - 1), radix);
            }
            else
            {
                value = parseInt(tmp, radix);
            }
        }

        // Convert to long
        if (value > LONG_THRESHOLD && Math.floor(value) === value && (s.indexOf('e') === -1 && s.indexOf('E') === -1))
        {
            // TODO: Does radix zero make sense?
            return numericLiteral.longAST(s, 0);
        }

        if (end === 'l' || end === 'L')
        {
            return numericLiteral.longAST(s.substr(0, s.length - 1), radix);
        }
        else
        {
            if (neg)
            {
                return numericLiteral.intAST(-value);
            }
            else
            {
                return numericLiteral.intAST(value);
            }
        }
    }

    function astForSlice(c, n)
    {
        REQ(n, SYM.subscript);

        /*
           subscript: '.' '.' '.' | test | [test] ':' [test] [sliceop]
           sliceop: ':' [test]
        */
        var ch = CHILD(n, 0);
        var lower = null;
        var upper = null;
        var step = null;
        if (ch.type === TOK.T_DOT)
            return new astnodes.Ellipsis();
        if (NCH(n) === 1 && ch.type === SYM.test)
            return new astnodes.Index(astForExpr(c, ch));
        if (ch.type === SYM.test)
            lower = astForExpr(c, ch);
        if (ch.type === TOK.T_COLON)
        {
            if (NCH(n) > 1)
            {
                var n2 = CHILD(n, 1);
                if (n2.type === SYM.test)
                    upper = astForExpr(c, n2);
            }
        }
        else if (NCH(n) > 2)
        {
            var n2 = CHILD(n, 2);
            if (n2.type === SYM.test)
                upper = astForExpr(c, n2);
        }

        ch = CHILD(n, NCH(n) - 1);
        if (ch.type === SYM.sliceop)
        {
            if (NCH(ch) === 1)
            {
                ch = CHILD(ch, 0);
                step = new astnodes.Name(strobj("None"), astnodes.Load, ch.lineno, ch.col_offset);
            }
            else
            {
                ch = CHILD(ch, 1);
                if (ch.type === SYM.test)
                    step = astForExpr(c, ch);
            }
        }
        return new astnodes.Slice(lower, upper, step);
    }

    function astForAtom(c, n)
    {
        /* atom: '(' [yield_expr|testlist_gexp] ')' | '[' [listmaker] ']'
           | '{' [dictmaker] '}' | '`' testlist '`' | NAME | NUMBER | STRING+
        */
        var ch = CHILD(n, 0);
        switch (ch.type)
        {
            case TOK.T_NAME:
                // All names start in astnodes.Load context, but may be changed later
                return new astnodes.Name(strobj(ch.value), astnodes.Load, n.lineno, n.col_offset);
            case TOK.T_STRING:
                return new astnodes.Str(parsestrplus(c, n), n.lineno, n.col_offset);
            case TOK.T_NUMBER:
            return new astnodes.Num(parsenumber(c, ch.value, n.lineno), n.lineno, n.col_offset);
            case TOK.T_LPAR: // various uses for parens
                ch = CHILD(n, 1);
                if (ch.type === TOK.T_RPAR)
                    return new astnodes.Tuple([], astnodes.Load, n.lineno, n.col_offset);
                if (ch.type === SYM.yield_expr)
                    return astForExpr(c, ch);
                if (NCH(ch) > 1 && CHILD(ch, 1).type === SYM.gen_for)
                    return astForGenexp(c, ch);
                return astForTestlistGexp(c, ch);
            case TOK.T_LSQB: // list or listcomp
                ch = CHILD(n, 1);
                if (ch.type === TOK.T_RSQB)
                    return new astnodes.List([], astnodes.Load, n.lineno, n.col_offset);
                REQ(ch, SYM.listmaker);
                if (NCH(ch) === 1 || CHILD(ch, 1).type === TOK.T_COMMA)
                    return new astnodes.List(seqForTestlist(c, ch), astnodes.Load, n.lineno, n.col_offset);
                else
                    return astForListcomp(c, ch);
            case TOK.T_LBRACE:
                /* dictmaker: test ':' test (',' test ':' test)* [','] */
                ch = CHILD(n, 1);
                var size = Math.floor((NCH(ch) + 1) / 4); // + 1 for no trailing comma case
                var keys = [];
                var values = [];
                for (var i = 0; i < NCH(ch); i += 4)
                {
                    keys[i / 4] = astForExpr(c, CHILD(ch, i));
                    values[i / 4] = astForExpr(c, CHILD(ch, i + 2));
                }
                return new astnodes.Dict(keys, values, n.lineno, n.col_offset);
            case TOK.T_BACKQUOTE:
                throw syntaxError("backquote not supported, use repr()", c.c_filename, n.lineno);
            default:
                asserts.fail("unhandled atom", ch.type);
        }
    }

    function astForPower(c, n)
    {
        /* power: atom trailer* ('**' factor)*
         */
        REQ(n, SYM.power);
        var e = astForAtom(c, CHILD(n, 0));
        if (NCH(n) === 1) return e;
        for (var i = 1; i < NCH(n); ++i)
        {
            var ch = CHILD(n, i);
            if (ch.type !== SYM.trailer)
                break;
            var tmp = astForTrailer(c, ch, e);
            tmp.lineno = e.lineno;
            tmp.col_offset = e.col_offset;
            e = tmp;
        }
        if (CHILD(n, NCH(n) - 1).type === SYM.factor)
        {
            var f = astForExpr(c, CHILD(n, NCH(n) - 1));
            e = new astnodes.BinOp(e, astnodes.Pow, f, n.lineno, n.col_offset);
        }
        return e;
    }

    function astForExpr(c, n)
    {
        /* handle the full range of simple expressions
           test: or_test ['if' or_test 'else' test] | lambdef
           or_test: and_test ('or' and_test)*
           and_test: not_test ('and' not_test)*
           not_test: 'not' not_test | comparison
           comparison: expr (comp_op expr)*
           expr: xor_expr ('|' xor_expr)*
           xor_expr: and_expr ('^' and_expr)*
           and_expr: shift_expr ('&' shift_expr)*
           shift_expr: arith_expr (('<<'|'>>') arith_expr)*
           arith_expr: term (('+'|'-') term)*
           term: factor (('*'|'/'|'%'|'//') factor)*
           factor: ('+'|'-'|'~') factor | power
           power: atom trailer* ('**' factor)*

           As well as modified versions that exist for backward compatibility,
           to explicitly allow:
           [ x for x in lambda: 0, lambda: 1 ]
           (which would be ambiguous without these extra rules)

           old_test: or_test | old_lambdef
           old_lambdef: 'lambda' [vararglist] ':' old_test

        */

        LOOP: while (true) {
            switch (n.type)
            {
                case SYM.test:
                case SYM.old_test:
                    if (CHILD(n, 0).type === SYM.lambdef || CHILD(n, 0).type === SYM.old_lambdef)
                        return astForLambdef(c, CHILD(n, 0));
                    else if (NCH(n) > 1)
                        return astForIfexpr(c, n);
                    // fallthrough
                case SYM.or_test:
                case SYM.and_test:
                    if (NCH(n) === 1)
                    {
                        n = CHILD(n, 0);
                        continue LOOP;
                    }
                    var seq = [];
                    for (var i = 0; i < NCH(n); i += 2)
                        seq[i / 2] = astForExpr(c, CHILD(n, i));
                    if (CHILD(n, 1).value === "and")
                        return new astnodes.BoolOp(astnodes.And, seq, n.lineno, n.col_offset);
                    asserts.assert(CHILD(n, 1).value === "or");
                    return new astnodes.BoolOp(astnodes.Or, seq, n.lineno, n.col_offset);
                case SYM.not_test:
                    if (NCH(n) === 1)
                    {
                        n = CHILD(n, 0);
                        continue LOOP;
                    }
                    else
                    {
                        return new astnodes.UnaryOp(astnodes.Not, astForExpr(c, CHILD(n, 1)), n.lineno, n.col_offset);
                    }
                case SYM.comparison:
                    if (NCH(n) === 1)
                    {
                        n = CHILD(n, 0);
                        continue LOOP;
                    }
                    else
                    {
                        var ops = [];
                        var cmps = [];
                        for (var i = 1; i < NCH(n); i += 2)
                        {
                            ops[(i - 1) / 2] = astForCompOp(c, CHILD(n, i));
                            cmps[(i - 1) / 2] = astForExpr(c, CHILD(n, i + 1));
                        }
                        return new astnodes.Compare(astForExpr(c, CHILD(n, 0)), ops, cmps, n.lineno, n.col_offset);
                    }
                case SYM.expr:
                case SYM.xor_expr:
                case SYM.and_expr:
                case SYM.shift_expr:
                case SYM.arith_expr:
                case SYM.term:
                    if (NCH(n) === 1)
                    {
                        n = CHILD(n, 0);
                        continue LOOP;
                    }
                    return astForBinop(c, n);
                case SYM.yield_expr:
                    var exp = null;
                    if (NCH(n) === 2)
                    {
                        exp = astForTestlist(c, CHILD(n, 1));
                    }
                    return new astnodes.Yield(exp, n.lineno, n.col_offset);
                case SYM.factor:
                    if (NCH(n) === 1)
                    {
                        n = CHILD(n, 0);
                        continue LOOP;
                    }
                    return astForFactor(c, n);
                case SYM.power:
                    return astForPower(c, n);
                default:
                    asserts.fail("unhandled expr", "n.type: %d", n.type);
            }
        break; }
    }

    function astForPrintStmt(c, n)
    {
        /* print_stmt: 'print' ( [ test (',' test)* [','] ]
                                 | '>>' test [ (',' test)+ [','] ] )
         */
        var start = 1;
        var dest = null;
        REQ(n, SYM.print_stmt);
        if (NCH(n) >= 2 && CHILD(n, 1).type === TOK.T_RIGHTSHIFT)
        {
            dest = astForExpr(c, CHILD(n, 2));
            start = 4;
        }
        var seq = [];
        for (var i = start, j = 0; i < NCH(n); i += 2, ++j)
        {
            seq[j] = astForExpr(c, CHILD(n, i));
        }
        var nl = (CHILD(n, NCH(n) - 1)).type === TOK.T_COMMA ? false : true;
        return new astnodes.Print(dest, seq, nl, n.lineno, n.col_offset);
    }

    function astForStmt(c, n)
    {
        if (n.type === SYM.stmt)
        {
            asserts.assert(NCH(n) === 1);
            n = CHILD(n, 0);
        }
        if (n.type === SYM.simple_stmt)
        {
            asserts.assert(numStmts(n) === 1);
            n = CHILD(n, 0);
        }
        if (n.type === SYM.small_stmt)
        {
            REQ(n, SYM.small_stmt);
            n = CHILD(n, 0);
            /* small_stmt: expr_stmt | print_stmt  | del_stmt | pass_stmt
                         | flow_stmt | import_stmt | global_stmt | exec_stmt
                         | assert_stmt
            */
            switch (n.type)
            {
                case SYM.expr_stmt: return astForExprStmt(c, n);
                case SYM.print_stmt: return astForPrintStmt(c, n);
                case SYM.del_stmt: return astForDelStmt(c, n);
                case SYM.pass_stmt: return new astnodes.Pass(n.lineno, n.col_offset);
                case SYM.flow_stmt: return astForFlowStmt(c, n);
                case SYM.import_stmt: return astForImportStmt(c, n);
                case SYM.global_stmt: return astForGlobalStmt(c, n);
                case SYM.exec_stmt: return astForExecStmt(c, n);
                case SYM.assert_stmt: return astForAssertStmt(c, n);
                default: asserts.fail("unhandled small_stmt");
            }
        }
        else
        {
            /* compound_stmt: if_stmt | while_stmt | for_stmt | try_stmt
                            | funcdef | classdef | decorated
            */
            var ch = CHILD(n, 0);
            REQ(n, SYM.compound_stmt);
            switch (ch.type)
            {
                case SYM.if_stmt: return astForIfStmt(c, ch);
                case SYM.while_stmt: return astForWhileStmt(c, ch);
                case SYM.for_stmt: return astForForStmt(c, ch);
                case SYM.try_stmt: return astForTryStmt(c, ch);
                case SYM.with_stmt: return astForWithStmt(c, ch);
                case SYM.funcdef: return astForFuncdef(c, ch, []);
                case SYM.classdef: return astForClassdef(c, ch, []);
                case SYM.decorated: return astForDecorated(c, ch);
                default: asserts.assert("unhandled compound_stmt");
            }
        }
    }

    var astFromParse = function(n, filename)
    {
        var c = new Compiling("utf-8", filename);

        var stmts = [];
        var ch;
        var k = 0;
        switch (n.type)
        {
            case SYM.file_input:
                for (var i = 0; i < NCH(n) - 1; ++i)
                {
                    var ch = CHILD(n, i);
                    if (n.type === TOK.T_NEWLINE)
                        continue;
                    REQ(ch, SYM.stmt);
                    var num = numStmts(ch);
                    if (num === 1)
                    {
                        stmts[k++] = astForStmt(c, ch);
                    }
                    else
                    {
                        ch = CHILD(ch, 0);
                        REQ(ch, SYM.simple_stmt);
                        for (var j = 0; j < num; ++j)
                        {
                            stmts[k++] = astForStmt(c, CHILD(ch, j * 2));
                        }
                    }
                }
                return new astnodes.Module(stmts);
            case SYM.eval_input:
                asserts.fail("todo;");
            case SYM.single_input:
                asserts.fail("todo;");
            default:
                asserts.fail("todo;");
        }
    };

    var astDump = function(node)
    {
        var _format = function(node)
        {
            if (node === null)
            {
                return "None";
            }
            else if (node.prototype && node.prototype._astname !== undefined && node.prototype._isenum)
            {
                return node.prototype._astname + "()";
            }
            else if (node._astname !== undefined)
            {
                var fields = [];
                for (var i = 0; i < node._fields.length; i += 2) // iter_fields
                {
                    var a = node._fields[i]; // field name
                    var b = node._fields[i + 1](node); // field getter func
                    fields.push([a, _format(b)]);
                }
                var attrs = [];
                for (var i = 0; i < fields.length; ++i)
                {
                    var field = fields[i];
                    attrs.push(field[0] + "=" + field[1].replace(/^\s+/, ''));
                }
                var fieldstr = attrs.join(',');
                return node._astname + "(" + fieldstr + ")";
            }
            else if (base.isArrayLike(node))
            {
                var elems = [];
                for (var i = 0; i < node.length; ++i)
                {
                    var x = node[i];
                    elems.push(_format(x));
                }
                var elemsstr = elems.join(',');
                return "[" + elemsstr.replace(/^\s+/, '') + "]";
            }
            else
            {
                var ret;
                if (node === true) ret = "True";
                else if (node === false) ret = "False";
    //          else if (Sk.ffi.isLong(node)) ret = Sk.ffi.remapToJs(node.tp$str());
    //          else if (Sk.builtin.isStringPy(node)) ret = Sk.builtin.stringToJs(node.tp$repr());
                else ret = "" + node;
                return ret;
            }
        };

        return _format(node);
    };

    var that =
    {
        'astFromParse': astFromParse,
        'astDump': astDump
    };
    return that;
});

define('davinci-py/symtable',['davinci-py/astnodes', 'davinci-py/asserts'], function(astnodes, asserts)
{
    /* Flags for def-use information */

    var DEF_GLOBAL = 1;           /* global stmt */
    var DEF_LOCAL = 2;            /* assignment in code block */
    var DEF_PARAM = 2 << 1;       /* formal parameter */
    var USE = 2 << 2;             /* name is used */
    var DEF_STAR = 2 << 3;        /* parameter is star arg */
    var DEF_DOUBLESTAR = 2 << 4;  /* parameter is star-star arg */
    var DEF_INTUPLE = 2 << 5;     /* name defined in tuple in parameters */
    var DEF_FREE = 2 << 6;        /* name used but not defined in nested block */
    var DEF_FREE_GLOBAL = 2 << 7; /* free variable is actually implicit global */
    var DEF_FREE_CLASS = 2 << 8;  /* free variable from class's method */
    var DEF_IMPORT = 2 << 9;      /* assignment occurred via import */

    var DEF_BOUND = (DEF_LOCAL | DEF_PARAM | DEF_IMPORT);

    /* GLOBAL_EXPLICIT and GLOBAL_IMPLICIT are used internally by the symbol
       table.  GLOBAL is returned from PyST_GetScope() for either of them.
       It is stored in ste_symbols at bits 12-14.
    */
    var SCOPE_OFF = 11;
    var SCOPE_MASK = 7;

    var LOCAL = 1;
    var GLOBAL_EXPLICIT = 2;
    var GLOBAL_IMPLICIT = 3;
    var FREE = 4;
    var CELL = 5;

    /* The following three names are used for the ste_unoptimized bit field */
    var OPT_IMPORT_STAR = 1;
    var OPT_EXEC = 2;
    var OPT_BARE_EXEC = 4;
    var OPT_TOPLEVEL = 8;  /* top-level names, including eval and exec */

    var GENERATOR = 2;
    var GENERATOR_EXPRESSION = 2;

    var ModuleBlock = 'module';
    var FunctionBlock = 'function';
    var ClassBlock = 'class';

    /**
     * @param {string} message
     * @param {string} filename
     * @param {number=} begin
     * @param {number=} end
     * @param {string=} line
     */
    function syntaxError(message, filename, begin, end, line)
    {
        return new Error(message);
    }

    /**
     * @param {string|null} priv
     * @param {string} name
     */
    function mangleName(priv, name)
    {
        var strpriv = null;

        if (priv === null || name === null || name.charAt(0) !== '_' || name.charAt(1) !== '_')
            return name;
        // don't mangle __id__
        if (name.charAt(name.length - 1) === '_' && name.charAt(name.length - 2) === '_')
            return name;
        // don't mangle classes that are all _ (obscure much?)
        strpriv = priv;
        strpriv.replace(/_/g, '');
        if (strpriv === '')
            return name;

        strpriv = priv;
        strpriv.replace(/^_*/, '');
        strpriv = '_' + strpriv + name;
        return strpriv;
    }

    /**
     * @constructor
     * @param {string} name
     * @param {number} flags
     * @param {Array.<SymbolTableScope>} namespaces
     */
    function Symbol(name, flags, namespaces)
    {
        this.__name = name;
        this.__flags = flags;
        this.__scope = (flags >> SCOPE_OFF) & SCOPE_MASK;
        this.__namespaces = namespaces || [];
    };
    Symbol.prototype.get_name = function() {return this.__name;};
    Symbol.prototype.is_referenced = function() {return !!(this.__flags & USE);};

    Symbol.prototype.is_parameter = function()
    {
        return !!(this.__flags & DEF_PARAM);
    };

    Symbol.prototype.is_global = function()
    {
        return this.__scope === GLOBAL_IMPLICIT || this.__scope == GLOBAL_EXPLICIT;
    };

    Symbol.prototype.is_declared_global = function()
    {
        return this.__scope == GLOBAL_EXPLICIT;
    };

    Symbol.prototype.is_local = function()
    {
        return !!(this.__flags & DEF_BOUND);
    };

    Symbol.prototype.is_free = function() { return this.__scope == FREE; };
    Symbol.prototype.is_imported = function() { return !!(this.__flags & DEF_IMPORT); };
    Symbol.prototype.is_assigned = function() { return !!(this.__flags & DEF_LOCAL); };
    Symbol.prototype.is_namespace = function() { return this.__namespaces && this.__namespaces.length > 0; };
    Symbol.prototype.get_namespaces = function() { return this.__namespaces; };

    var astScopeCounter = 0;

    /**
     * @constructor
     * @param {Object} table
     * @param {string} name
     * @param {string} type
     * @param {number} lineno
     */
    function SymbolTableScope(table, name, type, ast, lineno)
    {
        this.symFlags = {};
        this.name = name;
        this.varnames = [];
        /**
         * @type Array.<SymbolTableScope>
         */
        this.children = [];
        this.blockType = type;

        this.isNested = false;
        this.hasFree = false;
        this.childHasFree = false;  // true if child block has free vars including free refs to globals
        this.generator = false;
        this.varargs = false;
        this.varkeywords = false;
        this.returnsValue = false;

        this.lineno = lineno;

        this.table = table;

        if (table.cur && (table.cur.nested || table.cur.blockType === FunctionBlock))
            this.isNested = true;

        ast.scopeId = astScopeCounter++;
        table.stss[ast.scopeId] = this;

        // cache of Symbols for returning to other parts of code
        this.symbols = {};
    }

    SymbolTableScope.prototype.get_type = function() { return this.blockType; };
    SymbolTableScope.prototype.get_name = function() { return this.name; };
    SymbolTableScope.prototype.get_lineno = function() { return this.lineno; };
    SymbolTableScope.prototype.is_nested = function() { return this.isNested; };
    SymbolTableScope.prototype.has_children = function() { return this.children.length > 0; };
    SymbolTableScope.prototype.get_identifiers = function() { return this._identsMatching(function(x) { return true; }); };

    SymbolTableScope.prototype.lookup = function(name)
    {
        var sym;
        if (!this.symbols.hasOwnProperty(name))
        {
            var flags = this.symFlags[name];
            var namespaces = this.__check_children(name);
            sym = this.symbols[name] = new Symbol(name, flags, namespaces);
        }
        else
        {
            sym = this.symbols[name];
        }
        return sym;
    };

    SymbolTableScope.prototype.__check_children = function(name)
    {
        //print("  check_children:", name);
        var ret = [];
        for (var i = 0; i < this.children.length; ++i)
        {
            var child = this.children[i];
            if (child.name === name)
                ret.push(child);
        }
        return ret;
    };

    SymbolTableScope.prototype._identsMatching = function(f)
    {
        var ret = [];
        for (var k in this.symFlags)
        {
            if (this.symFlags.hasOwnProperty(k))
            {
                if (f(this.symFlags[k]))
                    ret.push(k);
            }
        }
        ret.sort();
        return ret;
    };

    SymbolTableScope.prototype.get_parameters = function()
    {
        asserts.assert(this.get_type() == 'function', "get_parameters only valid for function scopes");
        if (!this._funcParams)
            this._funcParams = this._identsMatching(function(x) { return x & DEF_PARAM; });
        return this._funcParams;
    };

    SymbolTableScope.prototype.get_locals = function()
    {
        asserts.assert(this.get_type() == 'function', "get_locals only valid for function scopes");
        if (!this._funcLocals)
            this._funcLocals = this._identsMatching(function(x) { return x & DEF_BOUND; });
        return this._funcLocals;
    };

    SymbolTableScope.prototype.get_globals = function()
    {
        asserts.assert(this.get_type() == 'function', "get_globals only valid for function scopes");
        if (!this._funcGlobals)
        {
            this._funcGlobals = this._identsMatching(function(x) {
                    var masked = (x >> SCOPE_OFF) & SCOPE_MASK;
                    return masked == GLOBAL_IMPLICIT || masked == GLOBAL_EXPLICIT;
                });
        }
        return this._funcGlobals;
    };

    SymbolTableScope.prototype.get_frees = function()
    {
        asserts.assert(this.get_type() == 'function', "get_frees only valid for function scopes");
        if (!this._funcFrees)
        {
            this._funcFrees = this._identsMatching(function(x) {
                    var masked = (x >> SCOPE_OFF) & SCOPE_MASK;
                    return masked == FREE;
                });
        }
        return this._funcFrees;
    };

    SymbolTableScope.prototype.get_methods = function()
    {
        asserts.assert(this.get_type() == 'class', "get_methods only valid for class scopes");
        if (!this._classMethods)
        {
            // todo; uniq?
            var all = [];
            for (var i = 0; i < this.children.length; ++i)
                all.push(this.children[i].name);
            all.sort();
            this._classMethods = all;
        }
        return this._classMethods;
    };

    SymbolTableScope.prototype.getScope = function(name)
    {
        //print("getScope");
        //for (var k in this.symFlags) print(k);
        var v = this.symFlags[name];
        if (v === undefined) return 0;
        return (v >> SCOPE_OFF) & SCOPE_MASK;
    };

    /**
     * @constructor
     * @param {string} filename
     */
    function SymbolTable(filename)
    {
        this.filename = filename;
        this.cur = null;
        this.top = null;
        this.stack = [];
        this.global = null; // points at top level module symFlags
        this.curClass = null; // current class or null
        this.tmpname = 0;

        // mapping from ast nodes to their scope if they have one. we add an
        // id to the ast node when a scope is created for it, and store it in
        // here for the compiler to lookup later.
        this.stss = {};
    }

    /**
     * Lookup the SymbolTableScope for a scopeId of the AST.
     */
    SymbolTable.prototype.getStsForAst = function(ast)
    {
        asserts.assert(ast.scopeId !== undefined, "ast wasn't added to st?");
        var v = this.stss[ast.scopeId];
        asserts.assert(v !== undefined, "unknown sym tab entry");
        return v;
    };

    SymbolTable.prototype.SEQStmt = function(nodes)
    {
        var len = nodes.length;
        for (var i = 0; i < len; ++i)
        {
            var val = nodes[i];
            if (val) this.visitStmt(val);
        }
    };
    SymbolTable.prototype.SEQExpr = function(nodes)
    {
        var len = nodes.length;
        for (var i = 0; i < len; ++i)
        {
            var val = nodes[i];
            if (val) this.visitExpr(val);
        }
    };

    SymbolTable.prototype.enterBlock = function(name, blockType, ast, lineno)
    {
    //  name = fixReservedNames(name);
        var prev = null;
        if (this.cur)
        {
            prev = this.cur;
            this.stack.push(this.cur);
        }
        this.cur = new SymbolTableScope(this, name, blockType, ast, lineno);
        if (name === 'top')
        {
            this.global = this.cur.symFlags;
        }
        if (prev)
        {
            prev.children.push(this.cur);
        }
    };

    SymbolTable.prototype.exitBlock = function()
    {
        //print("exitBlock");
        this.cur = null;
        if (this.stack.length > 0)
            this.cur = this.stack.pop();
    };

    SymbolTable.prototype.visitParams = function(args, toplevel)
    {
        for (var i = 0; i < args.length; ++i)
        {
            var arg = args[i];
            if (arg.constructor === astnodes.Name)
            {
                asserts.assert(arg.ctx === astnodes.Param || (arg.ctx === astnodes.Store && !toplevel));
                this.addDef(arg.id, DEF_PARAM, arg.lineno);
            }
            else
            {
                // Tuple isn't supported
                throw syntaxError("invalid expression in parameter list", this.filename);
            }
        }
    };

    SymbolTable.prototype.visitArguments = function(a, lineno)
    {
        if (a.args) this.visitParams(a.args, true);
        if (a.vararg)
        {
            this.addDef(a.vararg, DEF_PARAM, lineno);
            this.cur.varargs = true;
        }
        if (a.kwarg)
        {
            this.addDef(a.kwarg, DEF_PARAM, lineno);
            this.cur.varkeywords = true;
        }
    };

    /**
     * @param {number} lineno
     */
    SymbolTable.prototype.newTmpname = function(lineno)
    {
        this.addDef("_[" + (++this.tmpname) + "]", DEF_LOCAL, lineno);
    };

    /**
     * @param {string} name
     * @param {number} flag
     * @param {number} lineno
     */
    SymbolTable.prototype.addDef = function(name, flag, lineno)
    {
        var mangled = mangleName(this.curClass, name);
    //  mangled = fixReservedNames(mangled);
        var val = this.cur.symFlags[mangled];
        if (val !== undefined)
        {
            if ((flag & DEF_PARAM) && (val & DEF_PARAM))
            {
                throw syntaxError("duplicate argument '" + name + "' in function definition", this.filename, lineno);
            }
            val |= flag;
        }
        else
        {
            val = flag;
        }
        this.cur.symFlags[mangled] = val;
        if (flag & DEF_PARAM)
        {
            this.cur.varnames.push(mangled);
        }
        else if (flag & DEF_GLOBAL)
        {
            val = flag;
            var fromGlobal = this.global[mangled];
            if (fromGlobal !== undefined) val |= fromGlobal;
            this.global[mangled] = val;
        }
    };

    SymbolTable.prototype.visitSlice = function(s)
    {
        switch (s.constructor)
        {
            case astnodes.Slice:
                if (s.lower) this.visitExpr(s.lower);
                if (s.upper) this.visitExpr(s.upper);
                if (s.step) this.visitExpr(s.step);
                break;
            case astnodes.ExtSlice:
                for (var i = 0; i < s.dims.length; ++i)
                    this.visitSlice(s.dims[i]);
                break;
            case astnodes.Index:
                this.visitExpr(s.value);
                break;
            case astnodes.Ellipsis:
                break;
        }
    };

    /**
     * @param {Object} s
     */
    SymbolTable.prototype.visitStmt = function(s)
    {
        asserts.assert(s !== undefined, "visitStmt called with undefined");
        switch (s.constructor)
        {
            case astnodes.FunctionDef:
                this.addDef(s.name, DEF_LOCAL, s.lineno);
                if (s.args.defaults) this.SEQExpr(s.args.defaults);
                if (s.decorator_list) this.SEQExpr(s.decorator_list);
                this.enterBlock(s.name, FunctionBlock, s, s.lineno);
                this.visitArguments(s.args, s.lineno);
                this.SEQStmt(s.body);
                this.exitBlock();
                break;
            case astnodes.ClassDef:
                this.addDef(s.name, DEF_LOCAL, s.lineno);
                this.SEQExpr(s.bases);
                if (s.decorator_list) this.SEQExpr(s.decorator_list);
                this.enterBlock(s.name, ClassBlock, s, s.lineno);
                var tmp = this.curClass;
                this.curClass = s.name;
                this.SEQStmt(s.body);
                this.curCalss = tmp;
                this.exitBlock();
                break;
            case astnodes.Return_:
                if (s.value)
                {
                    this.visitExpr(s.value);
                    this.cur.returnsValue = true;
                    if (this.cur.generator)
                    {
                        throw syntaxError("'return' with argument inside generator", this.filename);
                    }
                }
                break;
            case astnodes.Delete_:
                this.SEQExpr(s.targets);
                break;
            case astnodes.Assign:
                this.SEQExpr(s.targets);
                this.visitExpr(s.value);
                break;
            case astnodes.AugAssign:
                this.visitExpr(s.target);
                this.visitExpr(s.value);
                break;
            case astnodes.Print:
                if (s.dest) this.visitExpr(s.dest);
                this.SEQExpr(s.values);
                break;
            case astnodes.For_:
                this.visitExpr(s.target);
                this.visitExpr(s.iter);
                this.SEQStmt(s.body);
                if (s.orelse) this.SEQStmt(s.orelse);
                break;
            case astnodes.While_:
                this.visitExpr(s.test);
                this.SEQStmt(s.body);
                if (s.orelse) this.SEQStmt(s.orelse);
                break;
            case astnodes.If_:
                this.visitExpr(s.test);
                this.SEQStmt(s.body);
                if (s.orelse)
                    this.SEQStmt(s.orelse);
                break;
            case astnodes.Raise:
                if (s.type)
                {
                    this.visitExpr(s.type);
                    if (s.inst)
                    {
                        this.visitExpr(s.inst);
                        if (s.tback)
                            this.visitExpr(s.tback);
                    }
                }
                break;
            case astnodes.TryExcept:
                this.SEQStmt(s.body);
                this.SEQStmt(s.orelse);
                this.visitExcepthandlers(s.handlers);
                break;
            case astnodes.TryFinally:
                this.SEQStmt(s.body);
                this.SEQStmt(s.finalbody);
                break;
            case astnodes.Assert:
                this.visitExpr(s.test);
                if (s.msg) this.visitExpr(s.msg);
                break;
            case astnodes.Import_:
            case astnodes.ImportFrom:
                this.visitAlias(s.names, s.lineno);
                break;
            case astnodes.Exec:
                this.visitExpr(s.body);
                if (s.globals)
                {
                    this.visitExpr(s.globals);
                    if (s.locals)
                        this.visitExpr(s.locals);
                }
                break;
            case astnodes.Global:
                var nameslen = s.names.length;
                for (var i = 0; i < nameslen; ++i)
                {
                    var name = mangleName(this.curClass, s.names[i]);
    //              name = fixReservedNames(name);
                    var cur = this.cur.symFlags[name];
                    if (cur & (DEF_LOCAL | USE))
                    {
                        if (cur & DEF_LOCAL)
                        {
                            throw syntaxError("name '" + name + "' is assigned to before global declaration", this.filename, s.lineno);
                        }
                        else
                        {
                            throw syntaxError("name '" + name + "' is used prior to global declaration", this.filename, s.lineno);
                        }
                    }
                    this.addDef(name, DEF_GLOBAL, s.lineno);
                }
                break;
            case astnodes.Expr:
                this.visitExpr(s.value);
                break;
            case astnodes.Pass:
            case astnodes.Break_:
            case astnodes.Continue_:
                // nothing
                break;
            case astnodes.With_:
                this.newTmpname(s.lineno);
                this.visitExpr(s.context_expr);
                if (s.optional_vars)
                {
                    this.newTmpname(s.lineno);
                    this.visitExpr(s.optional_vars);
                }
                this.SEQStmt(s.body);
                break;

            default:
                asserts.fail("Unhandled type " + s.constructor.name + " in visitStmt");
        }
    };

    SymbolTable.prototype.visitExpr = function(e)
    {
        asserts.assert(e !== undefined, "visitExpr called with undefined");
        //print("  e: ", e.constructor.name);
        switch (e.constructor)
        {
            case astnodes.BoolOp:
                this.SEQExpr(e.values);
                break;
            case astnodes.BinOp:
                this.visitExpr(e.left);
                this.visitExpr(e.right);
                break;
            case astnodes.UnaryOp:
                this.visitExpr(e.operand);
                break;
            case astnodes.Lambda:
                this.addDef("lambda", DEF_LOCAL, e.lineno);
                if (e.args.defaults)
                    this.SEQExpr(e.args.defaults);
                this.enterBlock("lambda", FunctionBlock, e, e.lineno);
                this.visitArguments(e.args, e.lineno);
                this.visitExpr(e.body);
                this.exitBlock();
                break;
            case astnodes.IfExp:
                this.visitExpr(e.test);
                this.visitExpr(e.body);
                this.visitExpr(e.orelse);
                break;
            case astnodes.Dict:
                this.SEQExpr(e.keys);
                this.SEQExpr(e.values);
                break;
            case astnodes.ListComp:
                this.newTmpname(e.lineno);
                this.visitExpr(e.elt);
                this.visitComprehension(e.generators, 0);
                break;
            case astnodes.GeneratorExp:
                this.visitGenexp(e);
                break;
            case astnodes.Yield:
                if (e.value) this.visitExpr(e.value);
                this.cur.generator = true;
                if (this.cur.returnsValue)
                {
                    throw syntaxError("'return' with argument inside generator", this.filename);
                }
                break;
            case astnodes.Compare:
                this.visitExpr(e.left);
                this.SEQExpr(e.comparators);
                break;
            case astnodes.Call:
                this.visitExpr(e.func);
                this.SEQExpr(e.args);
                for (var i = 0; i < e.keywords.length; ++i)
                    this.visitExpr(e.keywords[i].value);
                //print(JSON.stringify(e.starargs, null, 2));
                //print(JSON.stringify(e.kwargs, null,2));
                if (e.starargs) this.visitExpr(e.starargs);
                if (e.kwargs) this.visitExpr(e.kwargs);
                break;
            case astnodes.Num:
            case astnodes.Str:
                break;
            case astnodes.Attribute:
                this.visitExpr(e.value);
                break;
            case astnodes.Subscript:
                this.visitExpr(e.value);
                this.visitSlice(e.slice);
                break;
            case astnodes.Name:
                this.addDef(e.id, e.ctx === astnodes.Load ? USE : DEF_LOCAL, e.lineno);
                break;
            case astnodes.List:
            case astnodes.Tuple:
                this.SEQExpr(e.elts);
                break;
            default:
                asserts.fail("Unhandled type " + e.constructor.name + " in visitExpr");
        }
    };

    SymbolTable.prototype.visitComprehension = function(lcs, startAt)
    {
        var len = lcs.length;
        for (var i = startAt; i < len; ++i)
        {
            var lc = lcs[i];
            this.visitExpr(lc.target);
            this.visitExpr(lc.iter);
            this.SEQExpr(lc.ifs);
        }
    };

    /**
     * This is probably not correct for names. What are they?
     * @param {Array.<Object>} names
     * @param {number} lineno
     */
    SymbolTable.prototype.visitAlias = function(names, lineno)
    {
        /* Compute store_name, the name actually bound by the import
            operation.  It is diferent than a->name when a->name is a
            dotted package name (e.g. spam.eggs)
        */
        for (var i = 0; i < names.length; ++i)
        {
            var a = names[i];
            // DGH: The RHS used to be Python strings.
            var name = a.asname === null ? a.name : a.asname;
            var storename = name;
            var dot = name.indexOf('.');
            if (dot !== -1)
                storename = name.substr(0, dot);
            if (name !== "*")
            {
                this.addDef(storename, DEF_IMPORT, lineno);
            }
            else
            {
                if (this.cur.blockType !== ModuleBlock)
                {
                    throw syntaxError("import * only allowed at module level", this.filename);
                }
            }
        }
    };

    /**
     * @param {Object} e
     */
    SymbolTable.prototype.visitGenexp = function(e)
    {
        var outermost = e.generators[0];
        // outermost is evaled in current scope
        this.visitExpr(outermost.iter);
        this.enterBlock("genexpr", FunctionBlock, e, e.lineno);
        this.cur.generator = true;
        this.addDef(".0", DEF_PARAM, e.lineno);
        this.visitExpr(outermost.target);
        this.SEQExpr(outermost.ifs);
        this.visitComprehension(e.generators, 1);
        this.visitExpr(e.elt);
        this.exitBlock();
    };

    SymbolTable.prototype.visitExcepthandlers = function(handlers)
    {
        for (var i = 0, eh; eh = handlers[i]; ++i)
        {
            if (eh.type) this.visitExpr(eh.type);
            if (eh.name) this.visitExpr(eh.name);
            this.SEQStmt(eh.body);
        }
    };

    function _dictUpdate(a, b)
    {
        for (var kb in b)
        {
            a[kb] = b[kb];
        }
    }

    /**
     * @param {Object} ste The Symbol Table Scope.
     */
    SymbolTable.prototype.analyzeBlock = function(ste, bound, free, global)
    {
        var local = {};
        var scope = {};
        var newglobal = {};
        var newbound = {};
        var newfree = {};

        if (ste.blockType == ClassBlock)
        {
            _dictUpdate(newglobal, global);
            if (bound)
                _dictUpdate(newbound, bound);
        }

        for (var name in ste.symFlags)
        {
            var flags = ste.symFlags[name];
            this.analyzeName(ste, scope, name, flags, bound, local, free, global);
        }

        if (ste.blockType !== ClassBlock)
        {
            if (ste.blockType === FunctionBlock)
                _dictUpdate(newbound, local);
            if (bound)
                _dictUpdate(newbound, bound);
            _dictUpdate(newglobal, global);
        }

        var allfree = {};
        var childlen = ste.children.length;
        for (var i = 0; i < childlen; ++i)
        {
            var c = ste.children[i];
            this.analyzeChildBlock(c, newbound, newfree, newglobal, allfree);
            if (c.hasFree || c.childHasFree)
                ste.childHasFree = true;
        }

        _dictUpdate(newfree, allfree);
        if (ste.blockType === FunctionBlock) this.analyzeCells(scope, newfree);
        this.updateSymbols(ste.symFlags, scope, bound, newfree, ste.blockType === ClassBlock);

        _dictUpdate(free, newfree);
    };

    SymbolTable.prototype.analyzeChildBlock = function(entry, bound, free, global, childFree)
    {
        var tempBound = {};
        _dictUpdate(tempBound, bound);
        var tempFree = {};
        _dictUpdate(tempFree, free);
        var tempGlobal = {};
        _dictUpdate(tempGlobal, global);

        this.analyzeBlock(entry, tempBound, tempFree, tempGlobal);
        _dictUpdate(childFree, tempFree);
    };

    SymbolTable.prototype.analyzeCells = function(scope, free)
    {
        for (var name in scope)
        {
            var flags = scope[name];
            if (flags !== LOCAL) continue;
            if (free[name] === undefined) continue;
            scope[name] = CELL;
            delete free[name];
        }
    };

    /**
     * store scope info back into the st symbols dict. symbols is modified,
     * others are not.
     */
    SymbolTable.prototype.updateSymbols = function(symbols, scope, bound, free, classflag)
    {
        for (var name in symbols)
        {
            var flags = symbols[name];
            var w = scope[name];
            flags |= w << SCOPE_OFF;
            symbols[name] = flags;
        }

        var freeValue = FREE << SCOPE_OFF;
        var pos = 0;
        for (var name in free)
        {
            var o = symbols[name];
            if (o !== undefined)
            {
                // it could be a free variable in a method of the class that has
                // the same name as a local or global in the class scope
                if (classflag && (o & (DEF_BOUND | DEF_GLOBAL)))
                {
                    var i = o | DEF_FREE_CLASS;
                    symbols[name] = i;
                }
                // else it's not free, probably a cell
                continue;
            }
            if (bound[name] === undefined) continue;
            symbols[name] = freeValue;
        }
    };

    /**
     * @param {Object} ste The Symbol Table Scope.
     * @param {string} name
     */
    SymbolTable.prototype.analyzeName = function(ste, dict, name, flags, bound, local, free, global)
    {
        if (flags & DEF_GLOBAL)
        {
            if (flags & DEF_PARAM) throw syntaxError("name '" + name + "' is local and global", this.filename, ste.lineno);
            dict[name] = GLOBAL_EXPLICIT;
            global[name] = null;
            if (bound && bound[name] !== undefined) delete bound[name];
            return;
        }
        if (flags & DEF_BOUND)
        {
            dict[name] = LOCAL;
            local[name] = null;
            delete global[name];
            return;
        }

        if (bound && bound[name] !== undefined)
        {
            dict[name] = FREE;
            ste.hasFree = true;
            free[name] = null;
        }
        else if (global && global[name] !== undefined)
        {
            dict[name] = GLOBAL_IMPLICIT;
        }
        else
        {
            if (ste.isNested)
                ste.hasFree = true;
            dict[name] = GLOBAL_IMPLICIT;
        }
    };

    SymbolTable.prototype.analyze = function()
    {
        var free = {};
        var global = {};
        this.analyzeBlock(this.top, null, free, global);
    };

    /**
     * @param {Object} ast
     * @param {string} filename
     */
    var symbolTable = function(ast, filename)
    {
        var ret = new SymbolTable(filename);

        ret.enterBlock("top", ModuleBlock, ast, 0);
        ret.top = ret.cur;

        //print(Sk.astDump(ast));
        for (var i = 0; i < ast.body.length; ++i)
            ret.visitStmt(ast.body[i]);

        ret.exitBlock();

        ret.analyze();

        return ret;
    };

    var dumpSymbolTable = function(st)
    {
        var pyBoolStr = function(b)
        {
            return b ? "True" : "False";
        };
        var pyList = function(l)
        {
            var ret = [];
            for (var i = 0; i < l.length; ++i)
            {
                // TODO: Originally, this computed the Python repr().
                ret.push(l[i]);
            }
            return '[' + ret.join(', ') + ']';
        };
        var getIdents = function(obj, indent)
        {
            if (indent === undefined) indent = "";
            var ret = "";
            ret += indent + "Sym_type: " + obj.get_type() + "\n";
            ret += indent + "Sym_name: " + obj.get_name() + "\n";
            ret += indent + "Sym_lineno: " + obj.get_lineno() + "\n";
            ret += indent + "Sym_nested: " + pyBoolStr(obj.is_nested()) + "\n";
            ret += indent + "Sym_haschildren: " + pyBoolStr(obj.has_children()) + "\n";
            if (obj.get_type() === "class")
            {
                ret += indent + "Class_methods: " + pyList(obj.get_methods()) + "\n";
            }
            else if (obj.get_type() === "function")
            {
                ret += indent + "Func_params: " + pyList(obj.get_parameters()) + "\n";
                ret += indent + "Func_locals: " + pyList(obj.get_locals()) + "\n";
                ret += indent + "Func_globals: " + pyList(obj.get_globals()) + "\n";
                ret += indent + "Func_frees: " + pyList(obj.get_frees()) + "\n";
            }
            ret += indent + "-- Identifiers --\n";
            var objidents = obj.get_identifiers();
            var objidentslen = objidents.length;
            for (var i = 0; i < objidentslen; ++i)
            {
                var info = obj.lookup(objidents[i]);
                ret += indent + "name: " + info.get_name() + "\n";
                ret += indent + "  is_referenced: " + pyBoolStr(info.is_referenced()) + "\n";
                ret += indent + "  is_imported: " + pyBoolStr(info.is_imported()) + "\n";
                ret += indent + "  is_parameter: " + pyBoolStr(info.is_parameter()) + "\n";
                ret += indent + "  is_global: " + pyBoolStr(info.is_global()) + "\n";
                ret += indent + "  is_declared_global: " + pyBoolStr(info.is_declared_global()) + "\n";
                ret += indent + "  is_local: " + pyBoolStr(info.is_local()) + "\n";
                ret += indent + "  is_free: " + pyBoolStr(info.is_free()) + "\n";
                ret += indent + "  is_assigned: " + pyBoolStr(info.is_assigned()) + "\n";
                ret += indent + "  is_namespace: " + pyBoolStr(info.is_namespace()) + "\n";
                var nss = info.get_namespaces();
                var nsslen = nss.length;
                ret += indent + "  namespaces: [\n";
                var sub = [];
                for (var j = 0; j < nsslen; ++j)
                {
                    var ns = nss[j];
                    sub.push(getIdents(ns, indent + "    "));
                }
                ret += sub.join('\n');
                ret += indent + '  ]\n';
            }
            return ret;
        };
        return getIdents(st.top, '');
    };

    var that =
    {
        symbolTable: symbolTable,
        mangleName: mangleName,
        LOCAL: LOCAL,
        GLOBAL_EXPLICIT: GLOBAL_EXPLICIT,
        GLOBAL_IMPLICIT: GLOBAL_IMPLICIT,
        FREE: FREE,
        CELL: CELL,
        FunctionBlock: FunctionBlock,
        dumpSymbolTable: dumpSymbolTable
    };
    return that;
});

define('davinci-py',['require','davinci-py/core','davinci-py/base','davinci-py/asserts','davinci-py/tables','davinci-py/astnodes','davinci-py/parser','davinci-py/builder','davinci-py/symtable','davinci-py/tokenize','davinci-py/numericLiteral'],function(require)
{
  var that = require('davinci-py/core');

  that.base = require('davinci-py/base');

  that.asserts = require('davinci-py/asserts');
  that.tables = require('davinci-py/tables');
  that.astnodes = require('davinci-py/astnodes');

  that.parser = require('davinci-py/parser');
  that.builder = require('davinci-py/builder');
  that.symtable = require('davinci-py/symtable');
  that.tokenize = require('davinci-py/tokenize');
  that.numericLiteral = require('davinci-py/numericLiteral');
//that.compiler = require('davinci-py/compiler');

  return that;
});

  var library = require('davinci-py');
  /**
   * @suppress {undefinedVars}
   */
  (function() {
  if(typeof module !== 'undefined' && module.exports) {
    module.exports = library;
  } else if(globalDefine) {
    (function (define) {
      define(function () { return library; });
    }(globalDefine));
  } else {
    global['davinciPy'] = library;
  }
  })();
}(/** @type {*} */(this), undefined));