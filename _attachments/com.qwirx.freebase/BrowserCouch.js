goog.provide('com.qwirx.freebase.BrowserCouch');

goog.require('com.qwirx.util.UUID');

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *	 Atul Varma <atul@mozilla.com>
 *	 Peter Braden <peterbraden@peterbraden.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// = BrowserCouch =
//
// BrowserCouch is a client side map-reduce data store, inspired by CouchDB. It
// utilizes the browser's local storage where possible, and syncs to a CouchDB
// server.

/**
 * BrowserCouch is the main object that clients will use. It's
 * intended to be somewhat analogous to CouchDB's RESTful API.
 *
 * It's a wrapper to the database that emulates the HTTP methods
 * available on /<database>/ using CouchDB.
 */
com.qwirx.freebase.BrowserCouch = function(name, options)
{
	assert(this instanceof com.qwirx.freebase.BrowserCouch);
	// Use the new operator to call this constructor

	this.db_name = name;
	this.loaded = false;
	this.loadcbs = [];
	this.options = options || {};
	this.support = options.support ||
		new com.qwirx.freebase.BrowserCouch.ClosureSupport();
};

/**
 * Fire the onload callbacks.
 */
com.qwirx.freebase.BrowserCouch.prototype.fireOnLoadCallbacks =
	function()
{
	if (this.loaded)
	{
		throw new Error("Database already loaded");
	}
	
	this.loaded = true;
	for (var cbi = 0; cbi < this.loadcbs.length; cbi++)
	{
		this.loadcbs[cbi].call(this);
	}
};

// == Utility Functions ==

// === {{{ModuleLoader}}} ===
//
// A really basic module loader that allows dependencies to be
// "lazy-loaded" when their functionality is needed.
	
com.qwirx.freebase.BrowserCouch.ModuleLoader = function()
{
};

com.qwirx.freebase.BrowserCouch.ModuleLoader.LIBS =
{
	JSON: "js/ext/json2.js",
	UUID: "uuid.js"
};

com.qwirx.freebase.BrowserCouch.ModuleLoader.require = 
	function(libs, cb)
{
	var i = 0,
		lastLib = "";

	if (!goog.isArray(libs))
	{
		libs = [libs];
	}

	function loadNextLib()
	{
		if (lastLib && !window[lastLib])
		{
			throw new Error("Failed to load library: " + lastLib);
		}
		
		if (i == libs.length)
		{
			cb();
		}
		else
		{
			var libName = libs[i];
			i += 1;
			if (window[libName])
			{
				loadNextLib();
			}
			else
			{
				var libUrl = com.qwirx.freebase.BrowserCouch.ModuleLoader.LIBS[libName];
				if (!libUrl)
				{
					throw new Error("Unknown lib: " + libName);
				}
				lastLib = libName;
				com.qwirx.freebase.BrowserCouch.ModuleLoader._loadScript(
					libUrl, window, loadNextLib);
			}
		}
	}

	loadNextLib();
};

com.qwirx.freebase.BrowserCouch.ModuleLoader.prototype._loadScript =
	function(url, window, cb)
{
	var doc = window.document;
	var script = doc.createElement("script");
	script.setAttribute("src", url);
	script.addEventListener("load",
		function onLoad()
		{
			script.removeEventListener("load", onLoad, false);
			cb();
		},
		false);

	if (doc.body)
	{
		doc.body.appendChild(script);
	}
	else
	{
		doc.head.appendChild(script);
	}
};
	
// == MapReducer Implementations ==
//
// //MapReducer// is a generic interface for any map-reduce
// implementation. Any object implementing this interface will need
// to be able to work asynchronously, passing back control to the
// client at a given interval, so that the client has the ability to
// pause/cancel or report progress on the calculation if needed.

// === {{{SingleThreadedMapReducer}}} ===
//
// A MapReducer that works on the current thread.
	
com.qwirx.freebase.BrowserCouch.SingleThreadedMapReducer = function(){};

com.qwirx.freebase.BrowserCouch.SingleThreadedMapReducer.prototype.map =
	function(map, dict, progress, chunkSize, finished)
{
	var mapDict = {};

	// null can be emitted as the key by a map function, but using
	// it as a dictionary key converts it to the string "null",
	// which is ambiguous if the map function ever emits a key
	// "null" as well. So we keep null-keyed items in a separate
	// object, mapNull.
	var mapNull = null;
	var keys = dict.getKeys();
	var currDoc;

	function emit(key, value)
	{
		// TODO: This assumes that the key will always be
		// an indexable value. We may have to hash the value,
		// though, if it's e.g. an Object.
		var item;

		if (key === null)
		{
			item = mapNull;
			if (!item)
			{
				item = mapNull = {ids: [], values: []};
			}
		}
		else
		{
			item = mapDict[key];
			if (!item)
			{
				item = mapDict[key] = {ids: [], values: []};
			}
		}

		item.ids.push(currDoc._id);
		item.values.push(value);
	}

	var i = 0;

	function continueMap()
	{
		var iAtStart = i;

		do
		{
			currDoc = dict.get(keys[i]);
			map(currDoc, emit);
			i++;
		} while (i - iAtStart < chunkSize &&
				 i < keys.length);

		if (i >= keys.length)
		{
			var mapKeys = [];
			
			if (mapNull)
			{
				mapKeys.push(null);
			}
			
			for (name in mapDict)
			{
				mapKeys.push(name);
			}
			
			mapKeys.sort();
			finished({dict: mapDict, keys: mapKeys, nulls: mapNull});
		}
		else
		{
			progress("map", i / keys.length, continueMap);
		}
	}

	continueMap();
};

com.qwirx.freebase.BrowserCouch.SingleThreadedMapReducer.prototype.reduce =
	function(reduce, mapResult, progress, chunkSize, finished)
{
	var rows = [];
	var mapDict = mapResult.dict;
	var mapKeys = mapResult.keys;
	var mapNull = mapResult.nulls;

	var i = 0;

	function continueReduce()
	{
		var iAtStart = i;

		do
		{
			var key = mapKeys[i];
			var item;

			if (key === null)
			{
				item = mapNull;
			}
			else
			{
				item = mapDict[key];
			}

			var keys = [];
			for (var j = 0; j < keys.length; j++)
			{
				newKeys.push([key, item.ids[j]]);
			}

			rows.push({key: key,
					 value: reduce(keys, item.values)});
			i++;
		} while (i - iAtStart < chunkSize &&
				 i < mapKeys.length)

		if (i == mapKeys.length)
		{
			finished(rows);
		}
		else
		{
			progress("reduce", i / mapKeys.length, continueReduce);
		}
	}

	continueReduce();
};

// === {{{WebWorkerMapReducer}}} ===
//
// A MapReducer that uses
// [[https://developer.mozilla.org/En/Using_DOM_workers|Web Workers]]
// for its implementation, allowing the client to take advantage of
// multiple processor cores and potentially decouple the map-reduce
// calculation from the user interface.
//
// The script run by spawned Web Workers is
// [[#js/worker-map-reducer.js|worker-map-reducer.js]].

com.qwirx.freebase.BrowserCouch.WebWorkerMapReducer = 
	function(numWorkers, Worker)
{
	if (!Worker)
	{
		Worker = window.Worker;
	}

	this.pool = [];

	function MapWorker(id)
	{
		var worker = new Worker('js/worker-map-reducer.js');
		var onDone;

		worker.onmessage = function(event)
		{
			onDone(event.data);
		};

		this.id = id;
		this.map = function MW_map(map, dict, cb)
		{
			onDone = cb;
			worker.postMessage({map: map.toString(), dict: dict});
		};
	}

	for (var i = 0; i < numWorkers; i++)
	{
		this.pool.push(new MapWorker(i));
	}
};

com.qwirx.freebase.BrowserCouch.WebWorkerMapReducer.prototype.map =
	function(map, dict, progress, chunkSize, finished)
{
	var keys = dict.getKeys();
	var size = keys.length;
	var workersDone = 0;
	var mapDict = {};

	function getNextChunk()
	{
		if (keys.length)
		{
			var chunkKeys = keys.slice(0, chunkSize);
			keys = keys.slice(chunkSize);
			var chunk = {};
			for (var i = 0; i < chunkKeys.length; i++)
			{
				chunk[chunkKeys[i]] = dict.get(chunkKeys[i]);
			}
			return chunk;
		}
		else
		{
			return null;
		}
	}

	function nextJob(mapWorker)
	{
		var chunk = getNextChunk();
		if (chunk)
		{
			mapWorker.map(map, chunk,
				function jobDone(aMapDict)
				{
					for (var name in aMapDict)
					{
						if (name in mapDict)
						{
							var item = mapDict[name];
							item.keys = item.keys.concat(aMapDict[name].keys);
							item.values = item.values.concat(aMapDict[name].values);
						}
						else
						{
							mapDict[name] = aMapDict[name];
						}
					}

					if (keys.length)
					{
						progress("map", (size - keys.length) / size,
							function() { nextJob(mapWorker); });
					}
					else
					{
						workerDone();
					}
				});
		}
		else
		{
			workerDone();
		}
	}

	function workerDone()
	{
		workersDone += 1;
		if (workersDone == numWorkers)
		{
			allWorkersDone();
		}
	}

	function allWorkersDone()
	{
		var mapKeys = [];
		for (var name in mapDict)
		{
			mapKeys.push(name);
		}
		mapKeys.sort();
		finished({dict: mapDict, keys: mapKeys});
	}

	for (var i = 0; i < this.pool.length; i++)
	{
		nextJob(this.pool[i]);
	}
};

// TODO: Actually implement our own reduce() method here instead
// of delegating to the single-threaded version.
com.qwirx.freebase.BrowserCouch.WebWorkerMapReducer.prototype.reduce =
	com.qwirx.freebase.BrowserCouch.SingleThreadedMapReducer.prototype.reduce;

com.qwirx.freebase.BrowserCouch.View = function(rows)
{
	this.rows = rows;

	function findRow(key, rows)
	{
		if (rows.length > 1)
		{
			var midpoint = Math.floor(rows.length / 2);
			var row = rows[midpoint];
			if (key < row.key)
			{
				return findRow(key, rows.slice(0, midpoint));
			}
			if (key > row.key)
			{
				return midpoint + findRow(key, rows.slice(midpoint));
			}
			return midpoint;
		}
		else
		{
			return 0;
		}
	}

	this.findRow = function(key)
	{
		return findRow(key, rows);
	};
};

// == MapView ==
com.qwirx.freebase.BrowserCouch.MapView = function(mapResult)
{
	var rows = [];
	var keyRows = [];

	var mapKeys = mapResult.keys;
	var mapDict = mapResult.dict;
	var mapNull = mapResult.nulls;

	for (var i = 0; i < mapKeys.length; i++)
	{
		var key = mapKeys[i];
		var item;
		
		if (key === null)
		{
			item = mapNull;
		}
		else
		{
			item = mapDict[key];
		}
		
		keyRows.push({key: key, pos: rows.length});
		var newRows = [];
		
		for (var j = 0; j < item.ids.length; j++)
		{
			var id = item.ids[j];
			var value = item.values[j];
			// Note: unlike objects, views in CouchDB do apparently
			// use "id" and not "_id" in their results, so don't
			// change this again.
			newRows.push({id: id, key: key, value: value});
		}
		
		newRows.sort(function(a, b)
		{
			if (a.id < b.id)
				return -1;
			if (a.id > b.id)
				return 1;
			return 0;
		});
		
		rows = rows.concat(newRows);
	}

	function findRow(key, keyRows)
	{
		if (keyRows.length > 1)
		{
			var midpoint = Math.floor(keyRows.length / 2);
			var keyRow = keyRows[midpoint];
			if (key < keyRow.key)
				return findRow(key, keyRows.slice(0, midpoint));
			if (key > keyRow.key)
				return findRow(key, keyRows.slice(midpoint));
			return keyRow.pos;
		}
		else
		{
			return keyRows[0].pos;
		}
	}

	this.rows = rows;
	this.findRow = function(key)
	{
		return findRow(key, keyRows);
	};
};
	
// == Storage Implementations ==
//
// //Storage// is a generic interface for a persistent storage
// implementation capable of storing JSON-able objects.
	
// === {{{FakeStorage}}} ===
//
// This Storage implementation isn't actually persistent; it's just
// a placeholder that can be used for testing purposes, or when no
// persistent storage mechanisms are available.

com.qwirx.freebase.BrowserCouch.FakeStorage = function()
{
	this.db = {};

};

com.qwirx.freebase.BrowserCouch.FakeStorage.prototype.deepCopy =
	function(obj)
{
	if (typeof(obj) == "object")
	{
		var copy;

		if (goog.isArray(obj))
			copy = new Array();
		else
			copy = new Object();

		for (name in obj)
		{
			if (obj.hasOwnProperty(name))
			{
				var property = obj[name];
				if (typeof(property) == "object")
					copy[name] = this.deepCopy(property);
				else
					copy[name] = property;
			}
		}

		return copy;
	}
	else
	{
		return obj;
	}
}

com.qwirx.freebase.BrowserCouch.FakeStorage.prototype.get =
	function(name, cb)
{
	if (!(name in this.db))
		cb(null);
	else
		cb(this.deepCopy(this.db[name]));
};

com.qwirx.freebase.BrowserCouch.FakeStorage.prototype.put =
	function(name, obj, cb)
{
	this.db[name] = this.deepCopy(obj);
	cb();
};

// === {{{LocalStorage}}} ===
//
// This Storage implementation uses the browser's HTML5 support for
// {{{localStorage}}} or {{{globalStorage}}} for object persistence.
//
// Each database is stored in a key, as a JSON encoded string. In 
// future we may want to rethink this as it's horribly innefficient

com.qwirx.freebase.BrowserCouch.LocalStorage = function(loader)
{
	this.loader = loader;
	
	if (window.globalStorage)
	{
		this.real_storage = window.globalStorage[location.hostname];
	}
	else if (window.localStorage)
	{
		this.real_storage = window.localStorage;
	}
	else
	{
		throw new Error("globalStorage/localStorage not available.");
	}
};

com.qwirx.freebase.BrowserCouch.LocalStorage.prototype.get = 
	function(name, cb)
{
	var self = this;
	if (name in this.real_storage && this.real_storage[name])
	{
		com.qwirx.freebase.BrowserCouch.ModuleLoader.require('JSON',
			function()
			{
				var obj = JSON.parse(self.real_storage[name]);
				cb(obj);
			});
	}
	else
	{
		cb(null);
	}
};

com.qwirx.freebase.BrowserCouch.LocalStorage.prototype.put = 
	function(name, obj, cb)
{
	var self = this;
	com.qwirx.freebase.BrowserCouch.ModuleLoader.require('JSON',
		function()
		{
			self.real_storage[name] = JSON.stringify(obj);
			cb.call(self);
		});
};

com.qwirx.freebase.BrowserCouch.LocalStorage.isAvailable =
	(window.location &&	window.location.protocol != "file:" &&
	(window.globalStorage || window.localStorage));
	
// === {{{Dictionary}}} ===
//
// A wrapper for a map-like data structure.	
//
com.qwirx.freebase.BrowserCouch.Dictionary = function()
{
	this.clear();
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.regenerateKeys =
	function()
{
	this.keys = [];
	for (key in this.dict)
	{
		this.keys.push(key);
	}
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.has =
	function(key)
{
	return (key in this.dict);
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.getKeys =
	function()
{
	this.keys.sort();
	return this.keys;
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.get =
	function(key)
{
	return this.dict[key];
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.values = function()
{
	var res = [];
	for (var d in this.dict)
	{
		res.push(this.dict[d]);
	}
	return res;
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.set =
	function(key, value)
{
	if (!(key in this.dict))
	{
		this.keys.push(key);
	}
	this.dict[key] = value;
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.remove =
	function(key)
{
	delete this.dict[key];

	// TODO: If we're in JS 1.6 and have Array.indexOf(), we
	// shouldn't have to rebuild the key index like this.
	this.regenerateKeys();
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.clear =
	function()
{
	this.dict = {};
	this.keys = [];
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.pickle =
	function()
{
	return this.dict;
};

com.qwirx.freebase.BrowserCouch.Dictionary.prototype.unpickle =
function(obj)
{
	this.dict = obj;
	this.regenerateKeys();
};

/**
 * A {com.qwirx.freebase.BrowserCouch.Database} which stores data in
 * the browser, using the provided <code>options.storage</code>,
 * which is usually either a {com.qwirx.freebase.BrowserCouch.LocalStorage}
 * or a {com.qwirx.freebase.BrowserCouch.FakeStorage}.
 */
com.qwirx.freebase.BrowserCouch.BrowserDatabase = function(name,
	options, cb)
{
	assert(this instanceof com.qwirx.freebase.BrowserCouch.BrowserDatabase);
	// Use the new operator to call this constructor

	options = options || {};
	this.options = options;
	this.storage_class = options.storage_class ||
		com.qwirx.freebase.BrowserCouch.LocalStorage;
	this.storage = new this.storage_class();
	this.dict = new com.qwirx.freebase.BrowserCouch.Dictionary();
	this.changes = []; //TODO - this is until I get seq working.
	this.seq = 1;
	this.mapReducer = options.mapReducer ||
		new com.qwirx.freebase.BrowserCouch.SingleThreadedMapReducer();
	this.viewClass = com.qwirx.freebase.BrowserCouch.View;
	this.mapViewClass = com.qwirx.freebase.BrowserCouch.MapView;

	com.qwirx.freebase.BrowserCouch.call(this, name, options);

	var self = this;
	this.storage.get(this.db_name,
		function(obj)
		{
			if (obj)
			{
				self.dict.unpickle(obj);
			}
			self.fireOnLoadCallbacks();
			if (cb)
			{
				cb(self);
			}
		});
};

goog.inherits(com.qwirx.freebase.BrowserCouch.BrowserDatabase,
	com.qwirx.freebase.BrowserCouch);

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.commitToStorage =
	function(cb)
{
	var self = this;
	
	this.storage.put(this.db_name, this.dict.pickle(), function()
	{
		// "this" is the storage object, not the BrowserCouch,
		// so we need to use "self" here.
		self.allDbs(function(allDbs)
		{
			// allDbs resets "this" to what we expect
			
			if (allDbs.indexOf(this.db_name) == -1)
			{
				allDbs.push(this.db_name);
				
				this._meta.put(this.ALL_DATABASES_KEY, allDbs, function()
		 		{
		 			// "_meta" is a storage object, so "this" points
		 			// to the storage object, not to the BrowserCouch.
		 			cb.call(self);
		 		});
			}
			else
			{
				cb.call(this);
			}
		});
	});
};

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.wipe =
	function(cb)
{
	this.dict.clear();
	this.commitToStorage(cb);
};

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.get =
	function(id, cb)
{
	if (!cb)
	{
		return;
	}
	else if (this.dict.has(id))
	{
		cb(this.dict.get(id));
	}
	else
	{
		cb(null);
	}
};
		
// === {{{PUT}}} ===
//
// This method is vaguely isomorphic to a 
// [[http://wiki.apache.org/couchdb/HTTP_Document_API#PUT|HTTP PUT]] to a 
// url with the specified {{{id}}}.
//
// It creates or updates a document
com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.put =
	function(document, cb, options)
{
	options = options || {};
	var self = this;
	
	var putObj = function(obj)
	{
		if (!obj._rev)
		{
			obj._rev = "1-" + (Math.random()*Math.pow(10,20)); 
			// We're using the naive random versioning, rather
			// than the md5 deterministic hash.
		}
		else
		{
			var iter = parseInt(obj._rev.split("-")[0]);
			obj._rev = "" + (iter+1) +	
				obj._rev.slice(obj._rev.indexOf("-"));
		}
		
		if (options && (!options.noSync))
		{
			self.changes.push(obj)
		}
		
		self.dict.set(obj._id, obj);
		
		// If new object 
		self.seq +=1;
	}

	if (goog.isArray(document))
	{
		for (var i = 0; i < document.length; i++)
		{
			putObj(document[i]);
		}
	}
	else
	{
		putObj(document);
	}

	this.commitToStorage(
		function BrowserDatabase_put_callback()
		{
			if (cb)
			{
				cb(document);
			}
		});
};
		
// === {{{POST}}} ===
// 
// Roughly isomorphic to the two POST options
// available in the REST interface. If an ID is present,
// then the functionality is the same as a PUT operation,
// however if there is no ID, then one will be created.
//
com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.post =
	function(data, cb, options)
{
	if (!data._id)
	{
		data._id = new com.qwirx.util.UUID().toString();
	}
	
	this.put(data, function(){cb(data)}, options);
};

// === {{{DELETE}}} ===
//
// Delete the document. 
com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.del =
	function(doc, cb)
{
	this.put({_id : doc._id, _rev : doc._rev, _deleted : true}, cb);
};

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.getLength =
	function()
{
	return this.dict.getKeys().length;
};

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.progress =
	function(phase, percent, resume)
{
	window.setTimeout(resume, this.DEFAULT_UI_BREATHE_TIME);
};

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.DEFAULT_CHUNK_SIZE =
	1000;
/**
 * If no progress callback is given, we'll automatically give the
 * UI a chance to breathe for this many milliseconds before continuing
 * processing.
 */
com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.DEFAULT_UI_BREATHE_TIME = 
	50;
	
/**
 * Perform a query on the data. Queries are in the form of
 * map-reduce functions. Takes an object of options:
 * 
 * @param options.map The map function to be applied to each document
 * (REQUIRED)
 * @param options.finished A callback for the result. (REQUIRED)
 * @param options.chunkSize
 * @param options.progress A callback to indicate progress of a query.
 * If no custom callback is provided, the default,
 * {com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.progress}
 * is used instead.
 * @param options.mapReducer A Map-Reduce engine, by default uses
 * {com.qwirx.freebase.BrowserCouch.SingleThreadedMapReducer}.
 * @param options.reduce The reduce function (optional).
 */
com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.view =
	function(options)
{
	if (!options.map)
		throw new Error('map function not provided');

	if (!options.finished)
		throw new Error('finished callback not provided');
		
	// Maximum number of items to process before giving the UI a chance
	// to breathe.
	var chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;

	var mapReducer = options.mapReducer || this.mapReducer;
	var self = this;

	mapReducer.map(
		options.map,
		this.dict,
		this.progress,
		chunkSize,
		function(mapResult)
		{
			if (options.reduce)
			{
				mapReducer.reduce(
					options.reduce,
					mapResult,
					self.progress,
					chunkSize,
					function(rows)
					{
						options.finished(new self.viewClass(rows));
					});
			}
			else
			{
				options.finished(new self.mapViewClass(mapResult));
			}
		});
};

com.qwirx.freebase.BrowserCouch.BrowserDatabase.prototype.getChanges =
	function(cb)
{
	cb.call(this, {results: this.dict.values()});
};
		
// ==== functionReplacer ====
// JSON.stringify ignores functions by default, but if there's
// a function in the object, we want to send the JavaScript string
// to the server, and we need a custom replacer to do that.
//
// In order for inheritance to work, since JSON.stringify changes
// "this" and we want to call the same replacer recursively, this is
// a function which constructs a closure when called like this:
// JSON.stringify(doc, new FunctionReplacer().f);

com.qwirx.freebase.BrowserCouch.FunctionReplacer = function()
{
	var self = this; // closure
	
	this.f = function(key, value)
	{
		if (jQuery.isFunction(value))
		{
			var v = value.toString();
			return v;
		}
		else if (jQuery.isPlainObject(value) || jQuery.isArray(value))
		{
			var newObject = {};
			jQuery.each(value,
				function(k, v)
				{
					newObject[k] = self.f(k, v);
				});
			return newObject;
		}
		else
		{
			return value;
		}
	};
};

/**
 * @constructor
 * A wrapper class to provide a simple, consistent interface to
 * AJAX support using Google Closure.
 */
com.qwirx.freebase.BrowserCouch.ClosureSupport = function() {};
/**
 * Makes a GET request to the specified URL, interprets the reply
 * as JSON, and passes it to options.success.
 *
 * @param {string=} url The URL to be accessed by the AJAX request.
 * @param {Object=} options Options for the AJAX request:
 * @param {Object=} options.data Additional data passed as parameters
 *	in the URL string.
 * @param {Function=} options.success Callback for successful response,
 *	almost always used (otherwise the response goes nowhere).
 * @param {Function=} options.error Callback for any error that occurs
 *	in the request-response process.
 * @param {string=} options.method The HTTP method to use, defaults to 'GET'.
 * @param {number=} options.timeout The timeout for the AJAX request,
 *	in milliseconds.
 * @param {Object=} options.xhrFields A map of fieldName-fieldValue
 *	pairs to set on the native XHR object. For example, you can use
 *	it to set withCredentials to true for cross-domain requests if
 *	needed. {com.qwirx.freebase.BrowserCouch.ClosureSupport}
 *	only supports the withCredentials attributee.
 * @param {string=} options.contentType The Content-Type header to
 *	send to the server. Mostly useful when sending JSON data to the
 *	server using PUT or POST requests. If not set, there is no official
 *	default, but goog.net.XhrIo does this:
 *	<blockquote>For POST requests, default to the url-encoded form
 *	content type unless this is a FormData request. For FormData,
 *	the browser will automatically adds a multipart/form-data content
 *	type with an appropriate multipart boundary.</blockquote>
 */
com.qwirx.freebase.BrowserCouch.ClosureSupport.prototype.getJSON =
	function(url, options)
{
	options = options || {};
	
	var xhr = new goog.net.XhrIo();
	goog.net.XhrIo.sendInstances_.push(xhr);
	
	goog.events.listen(xhr, goog.net.EventType.COMPLETE,
		function(event)
		{
			if (options.success)
			{
				options.success(event.target.getResponseJson());
			}
		});
	
	goog.events.listen(xhr,
		goog.net.EventType.READY,
		goog.partial(goog.net.XhrIo.cleanupSend_, xhr));
	
	if (options.error)
	{
		goog.events.listen(xhr, goog.net.EventType.ERROR,
			options.error);
	}
	
	if (options.timeout)
	{
		xhr.setTimeoutInterval(options.timeout);
	}
	
	if (options.contentType)
	{
		options.headers = options.headers || {};
		options.headers[goog.net.XhrIo.CONTENT_TYPE_HEADER] =
			options.contentType;
	}
	
	var xhrFields = options.xhrFields || {};
	if (xhrFields.withCredentials)
	{
		xhr.setWithCredentials(xhrFields.withCredentials || false);
	}
	
	xhr.send(url, options.method || 'GET', options.data,
		options.headers);
};

/**
 * Extends an object with another object. This operates 'in-place';
 * it does not create a new Object.
 * @param {Object} target The object to modify.
 * @param {...Object} var_args The objects from which values will be copied.
 * @return {Object} The modified target object.
 * @method
 */
com.qwirx.freebase.BrowserCouch.ClosureSupport.prototype.extend =
	function(target /* var_args */)
{
	return goog.object.extend.apply(this, arguments);
};

/**
 * Calls a function for each element in an object/map/hash. If
 * all calls return true, returns true. If any call returns false, returns
 * false at this point and does not continue to check the remaining elements.
 *
 * @param {Object} obj The object to check.
 * @param {Function} f The function to call for every element. This function
 *     takes 3 arguments (the element, the index and the object) and should
 *     return a boolean.
 * @param {Object=} opt_this This is used as the 'this' object within f.
 * @return {boolean} false if any element fails the test.
 */
com.qwirx.freebase.BrowserCouch.ClosureSupport.prototype.each =
	function(obj, f, opt_this)
{
	return goog.object.every(obj, f, opt_this);
};

/**
 * @classdesc Remote Database
 * A constructor for a database wrapper for the REST interface 
 * for a remote CouchDB server. Mainly for use in the syncing.
 * @param {string} url The URL to the CouchDB server
 * @param {Object} options Options for the AJAX request:
 * @param {Object=} options.functionReplacer The function to use
 *	to replace functions in objects with strings which the CouchDB
 *	server can accept. Defaults to an instance of
 *	{com.qwirx.freebase.BrowserCouch.ClosureSupport} which works for
 *	view map and reduce functions in CouchDB.
 * @param {com.qwirx.freebase.BrowserCouch.Support=} options.support
 *	An object to use to provide support services, such as AJAX
 *	methods and an extends() implementation. Defaults to
 *	an instance of {com.qwirx.freebase.BrowserCouch.ClosureSupport},
 *	which works if you have Google Closure loaded.
 */
com.qwirx.freebase.BrowserCouch.SameDomainDB = function(name, url,
	options, cb)
{
	assert(this instanceof com.qwirx.freebase.BrowserCouch.SameDomainDB);
	// Use the new operator to call this constructor
	
	options = options || {};
	this.url = url;
	this.seq = 0;
	this.functionReplacer = options.functionReplacer ||
		new com.qwirx.freebase.BrowserCouch.FunctionReplacer().f;
	com.qwirx.freebase.BrowserCouch.call(this, name, options);
	
	this.fireOnLoadCallbacks();
	
	if (cb)
	{
		cb(this);
	}
};

goog.inherits(com.qwirx.freebase.BrowserCouch.SameDomainDB,
	com.qwirx.freebase.BrowserCouch);

/**
 * Retrieve an object from the database, by its ID, passing it to the
 *	callback.
 * @param {Function=} opt_cb The callback function which receives the
 *	retrieved object.
 */
com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.get =
	function(id, opt_cb)
{
	this.support.getJSON(this.url + "/" + id, {'success': opt_cb});
};

com.qwirx.freebase.BrowserCouch.prototype.callback_with_exception_handling =
	function(options, cb, data)
{
	if (options.exceptionHandler)
	{
		try
		{
			if (cb)
			{
				cb.call(this, data);
			}
		}
		catch (ex)
		{
			options.exceptionHandler(ex);
		}
	}
	else
	{
		if (cb)
		{
			cb.call(this, data);
		}						
	}
};

/**
 * Depending on the method argument, performs a PUT or a POST request
 * on the connected database, using the support object passed to the
 * constructor.
 * @param {string} method PUT or POST
 * @param {Object} doc The document to PUT or POST to the server.
 * @param {Function} cb The callback to invoke with the result of
 *	sending the object to the server.
 * @param {Object} options Options for the PUT or POST request:
 * @param {string} options.uri The URI for the document, which
 *	defaults to <code>doc._id</code>.
 * @param {Function} options.ajaxErrorHandler An error handler
 *	function, with the signature
 *	<code>(jqXHR, textStatus, errorThrown)</code>. If no error
 *	handler is provided, an exception is thrown on error instead.
 */
com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.put_or_post =
	function(method, doc, cb, options)
{
	var database = this;
	var ajax_result_data;
	var default_options = {uri: (doc._id || "")};
	options = this.support.extend(default_options, options);
	
	this.support.getJSON({
		url: this.url + "/" + options.uri, 
		method: method,
		content: JSON.stringify(doc, this.functionReplacer),
		processData: false,
		contentType: 'application/json',
		success: function SameDomainDB_put_or_post_success_cb(data)
		{
			ajax_result_data = data;
		},
		error: function SameDomainDB_put_or_post_error_cb(jqXHR,
			textStatus, errorThrown)
		{
			if (options.ajaxErrorHandler)
			{
				options.ajaxErrorHandler(jqXHR,
					textStatus, errorThrown);
			}
			else
			{
				throw new Error(textStatus + ": " + errorThrown);
			}
		},
		complete: function SameDomainDB_put_or_post_complete_cb(data)
		{
			database._callback_with_exception_handling(options,
				cb, ajax_result_data);
		}
	});
};

// ==== Post one new document ====
// POST one document to the server, with the URI in doc._id
// for consistency, even though it doesn't exist yet. The
// callback is called with the response of the POST, which
// in the case of a _temp_view is the query results.

com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.post =
	function(doc, callback, options)
{
	this.put_or_post('POST', doc, callback, options);
};

// ==== Put one modified document ====
// PUT one document to the server, with the URI in doc._id
// (because this document already exists, and we're
// updating it). doc._rev is required by CouchDB.

com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.put =
	function SameDomainDB_put(doc, callback, options)
{
	this._put_or_post('PUT', doc, callback, options);
};

// ==== Post multiple new documents ====
// POST multiple documents to the server, with the URI
// optionally stored in each doc._id. Documents without a
// pre-assigned _id will be assigned one. Can optionally
// replace any existing documents, even if their _rev is
// not known, by executing a GET request for them first
// to find their current rev. Uses the bulk document
// API, http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API

com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.post_multiple =
	function SameDomainDB_post(docs, cb_after_all_posted, options)
{
	new com.qwirx.util.Nest(
		null, // our context variable, p
		function SameDomainDB_post_multiple_identify(p, nest)
		{
			if (options.replace_existing)
			{
				// for documents with no _rev, need to check
				// whether they exist first, and if so get
				// their existing _rev, in order to replace them.
		
				request = {keys: []};
				index = {};
		
				for (var i in docs)
				{
					doc = docs[i];
					if (doc._id && !doc._rev)
					{
						request.keys.push(doc._id);
						index[doc._id] = doc;
					}
				}
				
				this.support.getJSON(
					this.url + "/_all_docs",
					{
						method: 'POST',
						content: JSON.stringify(request),
						success: function SameDomainDB_post_multiple_id_ok(data,
							textStatus, jqXHR)
						{
							for (var i in data.rows)
							{
								var result = data.rows[i];
								if (!result.error && result.value &&
									result.value.rev)
								{
									var found_doc = index[result.id];
									found_doc._rev = result.value.rev;
								}
							}
						
							nest.next();
						},
						error: function(jqXHR, textStatus, errorThrown)
						{
							if (options.ajaxErrorHandler)
							{
								options.ajaxErrorHandler(jqXHR,
									textStatus, errorThrown);
							}
							// else ignore it, as jQuery does by default
						}
					});
			}
			else
			{
				nest.next();
			}
		}, /* SameDomainDB_post_multiple_identify */
		function SameDomainDB_post_multiple_send(p, i)
		{
			this.support.getJSON(
				this.url + "/_bulk_docs",
				{
					method: 'POST',
					contentType: 'application/json',
					data: JSON.stringify({docs: docs}),
					success: function SameDomainDB_post_multiple_id_ok(data,
						textStatus, jqXHR)
					{
						cb_after_all_posted.call(self, docs);
					},
					error: function(jqXHR, textStatus, errorThrown)
					{
						if (p.ajaxErrorHandler)
						{
							p.ajaxErrorHandler(jqXHR, textStatus,
								errorThrown);
						}
						// else ignore it, as jQuery does by default
					}
				});
		} /* SameDomainDB_post_multiple_send */
	) /* com.qwirx.util.Nest */ .call(this);
};

// ==== Get Changes ====
// We poll the {{{_changes}}} endpoint to get the most
// recent documents. At the moment, we're not storing the
// sequence numbers for each server, however this is on 
// the TODO list.

com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.getChanges =
	function(cb)
{
	var self = this;
	var url = this.url + "/_changes";
	
	this.support.getJSON(url, {since : rs.seq},
		function(data)
		{
			cb.call(self, data);
		});
};
			
/**
 * Similar to calling view() on a local database, but you should
 * specify a {{{design_doc}}} and a {{{view_name}}} in the 
 * {{{options}}}, to allow the view to be cached.
 *
 * If you do, the design document will be fetched and the map and
 * reduce functions compared with the ones that you passed to see
 * if they match, and if not the design document will be updated
 * (in the database) to cache the query for future use.
 *
 * If no {{{design_doc}}} or {{{view_name}}} is specified, a
 * temporary view is created, which is expensive but good for
 * development according to the CouchDB documentation.
 */
com.qwirx.freebase.BrowserCouch.SameDomainDB.prototype.view =
	function(options)
{
	if (!options.map)
		throw new Error('map function not provided');

	if (!options.finished)
		throw new Error('finished callback not provided');
		
	var design_doc_id = options.design_doc;
	var view_name = options.view_name;
	var update_doc = false;
	var design_doc;

	if (design_doc_id && view_name)
	{
		design_doc = get(design_doc_id);
		
		if (design_doc[view_name].map != options.map ||
			design_doc[view_name].reduce != options.reduce)
		{
			update_doc = true;
		}
	}
	else
	{
		design_doc = {};
		view_name = "temp";
		update_doc = true;
	}

	var self = this;
	
	function run_view()
	{
		self.get(design_doc_id + "/" + view_name,
			options.finished /* callback */);
	}
	
	if (update_doc)
	{
		design_doc.views = design_doc.views || {};
		design_doc.views[view_name] = {};
		design_doc.views[view_name].map = options.map;
		
		if (options.reduce)
		{
			design_doc.views[view_name].reduce = options.reduce;
		}
		
		if (design_doc_id)
		{
			// PUT the new view and then execute the query
			self.put(design_doc, run_view);
		}
		else
		{
			// POST a temporary view, returns the results
			self.post(design_doc.views.temp, options.finished,
				{uri: "_temp_view"});
		}
	}
	else
	{
		// GET existing view results
		run_view();
	}
};

com.qwirx.freebase.BrowserCouch.prototype.sync_once =
	function(target, options)
{
	var self = this;
	
	// ==== Get Changes ====
	target.getChanges(function(data)
	{
		if (data && data.results)
		{
			// ==== Merge new data back in ====
			// TODO, screw it, for now we'll assume the servers right.
			// - In future we need to store the conflicts in the doc
			var i = 0;
			for (var d in data.results)
			{
				target.get(data.results[d]._id, function(doc)
				{
					if (doc)
					{
						self.put(doc, function()
						{
							i++;
							if (i >= data.results.length)
							{
								if (options.update)
								{
									options.update.call(self, doc);
								}
							}
						});
					}	
				});
			}
		}
	});
		
	// ==== Send Changes ====
	// We'll ultimately use the bulk update methods, but for
	// now, just iterate through the queue with a req for each
	this.getChanges(function(x)
	{
		this.support.each(x.results, function(value, key, obj)
		{
			target.put(value);
		});
	});
};

/**
 * Function to sync the current database with a target database.
 *
 * @todo Currently the <code>target</code> has priority over the
 *	<code>source</code> in case of conflict, but that is a bug.
 *
 * @param {com.qwirx.freebase.BrowserCouch.Database} source The other
 *	database to replicate.
 * @param {Object=} options Replication options:
 * @param {function=(Object)} options.update A callback which is called
 *	whenever a document in the <code>source</code> database has been
 *	modified, passing the modified document as the only argument.
 * @param {boolean} options.continuous If present and true, an
 *	interval timer will be created and stored in
 *	<code>options.timer</code>, which will repeatedly sync the
 *	databases until stopped.
 * @param {number} options.timeout If present, and 
 *	<code>options.continuous</code> is true, this will be used as the
 *	replication interval in milliseconds.
 * @param {number=} options.timer Out parameter, only set if
 *	<code>options.continuous</code> is true, which stores the
 *	interval timer created with <code>setInterval</code>, allowing
 *	replication to be stopped.
 */
com.qwirx.freebase.BrowserCouch.prototype.sync =
	function(target, options)
{
	options = options || {};
	var self = this;
	
	function sync_wrapper()
	{
		self.sync_once(target, options);
	}
	
	sync_wrapper();
	
	if (options.continuous)
	{
		options.timer = setInterval(sync_wrapper,
			options.timeout || 3000);
	}
};

com.qwirx.freebase.BrowserCouch.prototype.META_DATABASE_NAME = 
	'com.qwirx.freebase.BrowserCouch.META_DATABASES';

com.qwirx.freebase.BrowserCouch.prototype.ALL_DATABASES_KEY = 
	'com.qwirx.freebase.BrowserCouch.ALL_DATABASES';

// === //List All Databases// ===
//
// Similar to {{{/_all_dbs}}} as there is no way to see what 
// keys are stored in localStorage, we have to store a metadata 
// database
//
com.qwirx.freebase.BrowserCouch.prototype.allDbs =
	function(cb)
{
	var self = this;
	
	this.ensureMeta(function(meta)
	{
		 meta.get(this.ALL_DATABASES_KEY, function(data)
		 {
		 	if (data)
		 	{
		 		cb.call(self, data);
		 	}
		 	else
		 	{
		 		meta.put(this.ALL_DATABASES_KEY, [], function()
		 		{
		 			cb.call(self, []);
		 		});
		 	}
		 });
	});
};
	
// === Load Metadata Database ===
// We store metadata, such as a list of databases etc,
// in a metadatabase. This will create a browsercouch
// wrapper for this database unless it's already loaded
com.qwirx.freebase.BrowserCouch.prototype.ensureMeta =
	function(cb, storage, options)
{
	this._meta = this._meta || new this.storage_class(this.META_DATABASE_NAME);
	cb.call(this, this._meta);
};

// ==== Add an onload function ====
// Seeing as we're completely callback driven, and you're
// frequently going to want to do a bunch of things once
// the database is loaded, being able to add an arbitrary
// number of onload functions is useful.
// 
// Onload functions are called with no arguments, but the 
// database object from the constructor is now ready. 
// (TODO - change this?)

com.qwirx.freebase.BrowserCouch.prototype.onload = function(func)
{
	if (this.loaded)
	{
		func.call(this);
	}
	else
	{
		this.loadcbs.push(func);
	}	 
};

