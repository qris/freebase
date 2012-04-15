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
 *   Atul Varma <atul@mozilla.com>
 *   Peter Braden <peterbraden@peterbraden.co.uk>
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

// = Nest =
//
// This is a utility class that helps to write procedural-style code
// (in-order flow of control) to make understanding simpler when using
// multiple nested callbacks. Simply construct the Nest with a
// generic parameter object (which you control) and an array of little
// functions (scriptlets).
//
// The scriptlets are called in sequence, being passed the parameter
// and the Nest, on which you should call the function next() to proceed
// to the next entry. If you return without calling next(), then the
// iteration finishes.
//
// You can call next() inside any of your callbacks and return paths,
// renaming it if necessary to avoid scope conflicts if you use nested
// iterators.
//
// When you call a function that calls a callback, you could pass a
// scriptlet as an argument, which calls i.next(). However, you can also
// just pass i.callback, which does this for you, like this:
//
// $(document).ready(new Nest({},
//	function f1(p, i)
//	{
//		callJqueryFunctionThatNeedsACallback(args,
//			// the long way around
//			function callback(p, i2)
//			{
//				i2.next(); // executes f2
//			});
//	},
//	function f2(p, i)
//	{
//		// the shortcut, which makes the callback call f3
//		callJqueryFunctionThatNeedsACallback(args, i.callback);
//	},
//	function f3(p, i) { ... },
//	// demo for passing an array instead of a callback, which calls
//	// callJqueryFunctionThatNeedsACallback and then, from the callback, f4
//	[callFunctionThatNeedsACallback, {}, Nest],
//	function f3(p, i) { ... },
// ));
//
// If you pass an array instead of a scriptlet, as above, the first element
// is the object (or null for a function), the second is the method or
// function, and the remaining elements are its arguments. You should pass
// Nest as one of the arguments, and it will be replaced by i.callback.
// This is ideal for calling functions that take callbacks as arguments.
//
// Only one argument is formal, the rest (the scriptlets) are accessed through
// the arguments variable.
//
// You can control which object becomes "this" during the callbacks to the
// scriptlets (except array scriptlets), by calling a Nest object using the
// call() builtin rather than just (). For example:
//
// var n = Nest({}, function(p, i) { alert(this); });
// n(); // alerts "null"
// n.call(this); // alerts whatever this currently is
// n.call("foo"); // alerts "foo"
//
// This is possible because the Nest makes an effort to preserve "this"
// when it calls your scriptlets.

function Nest(param)
{
	var nest = this;
	nest.list = arguments;
	nest.lastIndex = 0; // skip the first argument

	// === next() ===
	// Call this function on the Nest passed to your scriptlet to
	// execute the next scriptlet.
	nest.next = function Nest_next()
	{
		var index = nest.lastIndex + 1;
		if (index >= nest.list.length)
		{
			return;
		}
		
		nest.lastIndex = index;
		var scriptlet = nest.list[index];
	
		if (jQuery.isArray(scriptlet))
		{
			// First element is the function, remaining ones are args, except
			// the one which uses Nest that we replace with i.next
		
			// There is no slice() method in the Arguments object, unfortunately
			var args = scriptlet.slice(2);
		
			for (var i = 1; i < args.length; i++)
			{
				if (args[i] == Nest)
				{
					args[i] = nest.callback;
				}
			}
		
			// "this" is set by the array, not by the invocation of Nest()().
			var object = scriptlet[0];
			var method = scriptlet[1];
		
			method.apply(object, args);
		}
		else
		{
			// "this" was set by the caller, so preserve it.
			scriptlet.call(this, param, nest);
		}
	};

	nest.callback = function Nest_callback()
	{
		// save the parameters passed to the callback
		param.callbackArgs = arguments;
		// invoke the next scriptlet
		nest.next();
	};
	
	// we don't want to execute immediately, but only when the Nest is called
	// as a function (e.g. a $.document.ready() callback)
	return function Nest_executor()
	{
		// call the first scriptlet, preserving "this", skipping the
		// param object
		nest.next.call(this);
	}
}

function Apply(values, func, finished)
{
	var targetList = this;
	targetList.func = func;
	targetList.values = values;
	targetList.finished = finished;
	targetList.lastIndex = -1;
	
	targetList.callback = function Apply_callback()
	{
		var nextIndex = targetList.lastIndex + 1;
		
		if (targetList.values.length == nextIndex)
		{
			finished.call(targetList, targetList);
		}
		else
		{
			targetList.lastIndex = nextIndex;
			targetList.func(values[nextIndex], targetList.callback);
			/*
			function()
			{
				targetList.callback();
			});
			*/
		}
	};
	
	return this.callback();
}

Array.prototype.apply = function Array_apply(func, finished)
{
	return Apply.call(this, this, func, finished);
}

// = BrowserCouch =
//
// BrowserCouch is a client side map-reduce data store, inspired by CouchDB. It
// utilizes the browser's local storage where possible, and syncs to a CouchDB
// server.

var BrowserCouch = function(opts){
  var bc = {};
  
  // == Utility Functions ==
  
  // === {{{ModuleLoader}}} ===
  //
  // A really basic module loader that allows dependencies to be
  // "lazy-loaded" when their functionality is needed.
  
  bc.ModuleLoader = {
    LIBS: {JSON: "js/ext/json2.js",
           UUID: "uuid.js"},
  
    require: function ML_require(libs, cb) {
      var self = this,
          i = 0,
          lastLib = "";
  
      if (!goog.isArray(libs)){
        libs = [libs];
      }
  
      function loadNextLib() {
        if (lastLib && !window[lastLib]){
          throw new Error("Failed to load library: " + lastLib);
        }
        if (i == libs.length){
          cb();
        }
        else {
          var libName = libs[i];
          i += 1;
          if (window[libName]){
            loadNextLib();
          }
          else {
            var libUrl = self.LIBS[libName];
            if (!libUrl){
              throw new Error("Unknown lib: " + libName);
            }
            lastLib = libName;
            self._loadScript(libUrl, window, loadNextLib);
          }
        }
      }
  
      loadNextLib();
    },
  
    _loadScript: function ML__loadScript(url, window, cb) {
      var doc = window.document;
      var script = doc.createElement("script");
      script.setAttribute("src", url);
      script.addEventListener(
        "load",
        function onLoad() {
          script.removeEventListener("load", onLoad, false);
          cb();
        },
        false
      );
      
      if (doc.body)
      {
        doc.body.appendChild(script);
      }
      else
      {
        doc.head.appendChild(script);
      }
    }
  };
  
  // == MapReducer Implementations ==
  //
  // //MapReducer// is a generic interface for any map-reduce
  // implementation. Any object implementing this interface will need
  // to be able to work asynchronously, passing back control to the
  // client at a given interval, so that the client has the ability to
  // pause/cancel or report progress on the calculation if needed.
  
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
  
  bc.WebWorkerMapReducer = function WebWorkerMapReducer(numWorkers, Worker) {
    if (!Worker){
      Worker = window.Worker;
    }
  
    var pool = [];
  
    function MapWorker(id) {
      var worker = new Worker('js/worker-map-reducer.js');
      var onDone;
  
      worker.onmessage = function(event) {
        onDone(event.data);
      };
  
      this.id = id;
      this.map = function MW_map(map, dict, cb) {
        onDone = cb;
        worker.postMessage({map: map.toString(), dict: dict});
      };
    }
  
    for (var i = 0; i < numWorkers; i++){
      pool.push(new MapWorker(i));
    }
  
    this.map = function WWMR_map(map, dict, progress, chunkSize, finished) {
      var keys = dict.getKeys();
      var size = keys.length;
      var workersDone = 0;
      var mapDict = {};
  
      function getNextChunk() {
        if (keys.length) {
          var chunkKeys = keys.slice(0, chunkSize);
          keys = keys.slice(chunkSize);
          var chunk = {};
          for (var i = 0; i < chunkKeys.length; i++){
            chunk[chunkKeys[i]] = dict.get(chunkKeys[i]);
          }
          return chunk;
        } else {
          return null;
        }
      }
  
      function nextJob(mapWorker) {
        var chunk = getNextChunk();
        if (chunk) {
          mapWorker.map(
            map,
            chunk,
            function jobDone(aMapDict) {
              for (var name in aMapDict){
                if (name in mapDict) {
                  var item = mapDict[name];
                  item.keys = item.keys.concat(aMapDict[name].keys);
                  item.values = item.values.concat(aMapDict[name].values);
                } else{
                  mapDict[name] = aMapDict[name];
                }
              }
              if (keys.length){
                progress("map",
                         (size - keys.length) / size,
                         function() { nextJob(mapWorker); });
              }else{
                workerDone();
              }
            });
        } else{
          workerDone();
        }
      }
  
      function workerDone() {
        workersDone += 1;
        if (workersDone == numWorkers){
          allWorkersDone();
        }
      }
  
      function allWorkersDone() {
        var mapKeys = [];
        for (var name in mapDict){
          mapKeys.push(name);
        }
        mapKeys.sort();
        finished({dict: mapDict, keys: mapKeys});
      }
  
      for (var i = 0; i < numWorkers; i++){
        nextJob(pool[i]);
      }
    };
  
    // TODO: Actually implement our own reduce() method here instead
    // of delegating to the single-threaded version.
    this.reduce = bc.SingleThreadedMapReducer.reduce;
  };
  
  // === {{{SingleThreadedMapReducer}}} ===
  //
  // A MapReducer that works on the current thread.
  
  bc.SingleThreadedMapReducer = {
    map: function STMR_map(map, dict, progress,
                           chunkSize, finished) {
      var mapDict = {};
      
      // null can be emitted as the key by a map function, but using
      // it as a dictionary key converts it to the string "null",
      // which is ambiguous if the map function ever emits a key
      // "null" as well. So we keep null-keyed items in a separate
      // object, mapNull.
      var mapNull = null;
      var keys = dict.getKeys();
      var currDoc;
  
      function emit(key, value) {
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
  
      function continueMap() {
        var iAtStart = i;
  
        do {
          currDoc = dict.get(keys[i]);
          map(currDoc, emit);
          i++;
        } while (i - iAtStart < chunkSize &&
                 i < keys.length);
  
        if (i >= keys.length) {
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
        } else
          progress("map", i / keys.length, continueMap);
      }
  
      continueMap();
    },
  
    reduce: function STMR_reduce(reduce, mapResult, progress,
                                 chunkSize, finished) {
      var rows = [];
      var mapDict = mapResult.dict;
      var mapKeys = mapResult.keys;
      var mapNull = mapResult.nulls;
  
      var i = 0;
  
      function continueReduce() {
        var iAtStart = i;
  
        do {
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
            newKeys.push([key, item.ids[j]]);
  
          rows.push({key: key,
                     value: reduce(keys, item.values)});
          i++;
        } while (i - iAtStart < chunkSize &&
                 i < mapKeys.length)
  
        if (i == mapKeys.length)
          finished(rows);
        else
          progress("reduce", i / mapKeys.length, continueReduce);
      }
  
      continueReduce();
    }
  };
  
    
  
    // == View ==
  bc._View = function BC__View(rows) {
    this.rows = rows;

    function findRow(key, rows) {
      if (rows.length > 1) {
        var midpoint = Math.floor(rows.length / 2);
        var row = rows[midpoint];
        if (key < row.key)
          return findRow(key, rows.slice(0, midpoint));
        if (key > row.key)
          return midpoint + findRow(key, rows.slice(midpoint));
        return midpoint;
      } else
        return 0;
    }

    this.findRow = function V_findRow(key) {
      return findRow(key, rows);
    };
  },
  

  // == MapView ==
  bc._MapView = function BC__MapView(mapResult) {
    var rows = [];
    var keyRows = [];

    var mapKeys = mapResult.keys;
    var mapDict = mapResult.dict;
    var mapNull = mapResult.nulls;

    for (var i = 0; i < mapKeys.length; i++) {
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
      for (var j = 0; j < item.ids.length; j++) {
        var id = item.ids[j];
        var value = item.values[j];
        newRows.push({id: id,
                      key: key,
                      value: value});
      }
      newRows.sort(function(a, b) {
                     if (a.id < b.id)
                       return -1;
                     if (a.id > b.id)
                       return 1;
                     return 0;
                   });
      rows = rows.concat(newRows);
    }

    function findRow(key, keyRows) {
      if (keyRows.length > 1) {
        var midpoint = Math.floor(keyRows.length / 2);
        var keyRow = keyRows[midpoint];
        if (key < keyRow.key)
          return findRow(key, keyRows.slice(0, midpoint));
        if (key > keyRow.key)
          return findRow(key, keyRows.slice(midpoint));
        return keyRow.pos;
      } else
        return keyRows[0].pos;
    }

    this.rows = rows;
    this.findRow = function MV_findRow(key) {
      return findRow(key, keyRows);
    };
  }
  

  
  
  // == Storage Implementations ==
  //
  // //Storage// is a generic interface for a persistent storage
  // implementation capable of storing JSON-able objects.
  
  
  // === {{{FakeStorage}}} ===
  //
  // This Storage implementation isn't actually persistent; it's just
  // a placeholder that can be used for testing purposes, or when no
  // persistent storage mechanisms are available.
  
  bc.FakeStorage = function FakeStorage() {
    var db = {};
  
    function deepCopy(obj) {
      if (typeof(obj) == "object") {
        var copy;
  
        if (goog.isArray(obj))
          copy = new Array();
        else
          copy = new Object();
  
        for (name in obj) {
          if (obj.hasOwnProperty(name)) {
            var property = obj[name];
            if (typeof(property) == "object")
              copy[name] = deepCopy(property);
            else
              copy[name] = property;
          }
        }
  
        return copy;
      } else
        return obj;
    }
  
    this.get = function FS_get(name, cb) {
      if (!(name in db))
        cb(null);
      else
        cb(db[name]);
    };
  
    this.put = function FS_put(name, obj, cb) {
      db[name] = deepCopy(obj);
      cb();
    };
  };
  
  // === {{{LocalStorage}}} ===
  //
  // This Storage implementation uses the browser's HTML5 support for
  // {{{localStorage}}} or {{{globalStorage}}} for object persistence.
  //
  // Each database is stored in a key, as a JSON encoded string. In 
  // future we may want to rethink this as it's horribly innefficient
  
  bc.LocalStorage = function LocalStorage() {
    var storage;
  
    if (window.globalStorage)
      storage = window.globalStorage[location.hostname];
    else {
      if (window.localStorage)
        storage = window.localStorage;
      else
        throw new Error("globalStorage/localStorage not available.");
    }
  
      
    this.get = function LS_get(name, cb) {
      if (name in storage && storage[name])//.value)
        bc.ModuleLoader.require('JSON',
          function() {
            var obj = JSON.parse(storage[name])//.value);
            cb(obj);
          });
      else
        cb(null);
    };
  
    this.put = function LS_put(name, obj, cb) {
      bc.ModuleLoader.require('JSON',
        function() {
          storage[name] = JSON.stringify(obj);
          cb();
        });
    };
  }
  
  bc.LocalStorage.isAvailable = (this.location &&
                              this.location.protocol != "file:" &&
                              (this.globalStorage || this.localStorage));
  
  
  // === {{{Dictionary}}} ===
  //
  // A wrapper for a map-like data structure.  
  //
  bc._Dictionary = function BC__Dictionary() {
    this.dict_ = {};
    var keys = [];

    function regenerateKeys() {
      keys = [];
      for (key in this.dict_)
        keys.push(key);
    }

    this.has = function Dictionary_has(key) {
      return (key in this.dict_);
    };

    this.getKeys = function Dictionary_getKeys() {
      return keys;
    };

    this.get = function Dictionary_get(key) {
      return this.dict_[key];
    };

    this.values = function(){
      var res = [];
      for (var d in this.dict_){
        res.push(this.dict_[d]);
      }
      return res;
    }
    
    this.set = function Dictionary_set(key, value) {
      if (!(key in this.dict_))
        keys.push(key);
      this.dict_[key] = value;
    };

    this.remove = function Dictionary_delete(key) {
      delete this.dict_[key];

      // TODO: If we're in JS 1.6 and have Array.indexOf(), we
      // shouldn't have to rebuild the key index like this.
      regenerateKeys();
    };

    this.clear = function Dictionary_clear() {
      this.dict_ = {};
      keys = [];
    };

    this.pickle = function Dictionary_pickle() {
      return this.dict_;
    };

    this.unpickle = function Dictionary_unpickle(obj) {
      this.dict_ = obj;
      regenerateKeys();
    };
  }


  // == Database Wrapper Interface == 
  //
  // A basic database interface. Implementing objects
  // should support methods that emulate the basic REST commands 
  // that CouchDB uses. 
  // 
  
  // === Local Storage Database ===
  // TODO, rename this
  bc.BrowserDatabase = function(options, cb) {
    var self = {},
        dbName = 'BrowserCouch_DB_' + options.name,
        syncManager, 
        storage = options.storage;
    self.dict_ = new bc._Dictionary();
    
    function commitToStorage(cb)
    {
      options.storage.put(dbName, self.dict_.pickle(), cb || function(){});  
    }
    
    self.chgs = []; //TODO - this is until I get seq working.
   
    self.wipe = function DB_wipe(cb) {
      this.dict_.clear();
      commitToStorage(cb);
    };

    self.get = function DB_get(id, cb) {
      cb = cb || function(){}
      if (this.dict_.has(id))
        cb(this.dict_.get(id));
      else
        cb(null);
    };
    
    // === {{{PUT}}} ===
    //
    // This method is vaguely isomorphic to a 
    // [[http://wiki.apache.org/couchdb/HTTP_Document_API#PUT|HTTP PUT]] to a 
    // url with the specified {{{id}}}.
    //
    // It creates or updates a document
    self.put = function DB_put(document, cb, options) {
      options = options || {};
      var putObj = function(obj){
        if (!obj._rev){
          obj._rev = "1-" + (Math.random()*Math.pow(10,20)); 
            // We're using the naive random versioning, rather
            // than the md5 deterministic hash.
        }else{
          var iter = parseInt(obj._rev.split("-")[0]);
          obj._rev = "" + (iter+1) +  
            obj._rev.slice(obj._rev.indexOf("-"));
        }
        if(options && (!options.noSync))
          self.chgs.push(obj)
        self.dict_.set(obj._id, obj);
        
        //If new object 
        self.seq +=1;
          
      }
    
      if (goog.isArray(document)) {
        for (var i = 0; i < document.length; i++){
          putObj(document[i]);
        }
      } else{
        putObj(document);
      }

      commitToStorage(
        function BrowserDatabase_put_callback()
        {
          cb(document);
        });
    };
    


    // === {{{POST}}} ===
    // 
    // Roughly isomorphic to the two POST options
    // available in the REST interface. If an ID is present,
    // then the functionality is the same as a PUT operation,
    // however if there is no ID, then one will be created.
    //
    self.post = function(data, cb, options){
      var _t = this;
      if (!data._id)
        bc.ModuleLoader.require('UUID', function(){
          data._id = new UUID().createUUID();
          _t.put(data, function(){cb(data)}, options);
        });
      else{  
        _t.put(data, function(){cb(data)}, options);
      }
    }

    // === {{{DELETE}}} ===
    //
    // Delete the document. 
    self.del = function(doc, cb){
      this.put({_id : doc._id, _rev : doc._rev, _deleted : true}, cb);
    }

    // 
    self.getLength = function DB_getLength() {
      return dict.getKeys().length;
    };

    // === View ===
    //
    // Perform a query on the data. Queries are in the form of
    // map-reduce functions.
    //
    // takes object of options:
    //
    // * {{{options.map}}} : The map function to be applied to each document
    //                       (REQUIRED)
    //
    // * {{{options.finished}}} : A callback for the result.
    //                           (REQUIRED)
    //
    // * {{{options.chunkSize}}}
    // * {{{options.progress}}} : A callback to indicate progress of a query
    // * {{{options.mapReducer}}} : A Map-Reduce engine, by default uses a 
    //                              single thread
    // * {{{options.reduce}}} : The reduce function 
    
    self.view = function DB_view(options) {
      if (!options.map)
        throw new Error('map function not provided');
      if (!options.finished)
        throw new Error('finished callback not provided');
        
      // SameDomainDB implements view() itself (on the server)
      if ('view' in this.storage)
      {
      	return this.storage.view(options);
      }

      // Maximum number of items to process before giving the UI a chance
      // to breathe.
      var DEFAULT_CHUNK_SIZE = 1000;

      // If no progress callback is given, we'll automatically give the
      // UI a chance to breathe for this many milliseconds before continuing
      // processing.
      var DEFAULT_UI_BREATHE_TIME = 50;

      var chunkSize = options.chunkSize;
      if (!chunkSize)
        chunkSize = DEFAULT_CHUNK_SIZE;

      var progress = options.progress;
      if (!progress)
        progress = function defaultProgress(phase, percent, resume) {
          window.setTimeout(resume, DEFAULT_UI_BREATHE_TIME);
        };

      var mapReducer = options.mapReducer;
      if (!mapReducer)
        mapReducer = bc.SingleThreadedMapReducer;

      mapReducer.map(
        options.map,
        this.dict_,
        progress,
        chunkSize,
        function(mapResult) {
          if (options.reduce)
            mapReducer.reduce(
              options.reduce,
              mapResult,
              progress,
              chunkSize,
              function(rows) {
                options.finished(new BrowserCouch._View(rows));
              });
          else
            options.finished(new BrowserCouch._MapView(mapResult));
        });
    };
    
    self.getChanges = function(cb){
      cb({results: this.dict_.values()});
    }
      
    storage.get(
      dbName,
      function(obj) {
        if (obj)
          self.dict_.unpickle(obj);
        cb(self);
      });
    
    
      
  
  }

	// ==== functionReplacer ====
	// JSON.stringify ignores functions by default, but if there's
	// a function in the object, we want to send the JavaScript string
	// to the server, and we need a custom replacer to do that.
	//
	// In order for inheritance to work, since JSON.stringify changes
	// "this" and we want to call the same replacer recursively, this is
	// a function which constructs a closure when called like this:
	// JSON.stringify(doc, new FunctionReplacer().f);

	bc.FunctionReplacer = function()
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
  
	// === Remote Database ===
	// A constructor for a database wrapper for the REST interface 
	// for a remote CouchDB server. Mainly for use in the syncing.
	// 
	//
	bc.SameDomainDB = function SameDomainDB(options, cb) {
		var rs = {
			url: options.url,
			seq: 0,
			functionReplacer: new bc.FunctionReplacer().f,

			get : function SameDomainDB_get(id, cb)
			{
				var database = this;
				$.getJSON(this.url + "/" + id, {}, cb || function(){}); 
			},
			
			_callback_with_exception_handling: function(options, cb, data)
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
			},
      
			_put_or_post: function(method, doc, cb, options)
			{
				var database = this;
				var ajax_result_data;
				var default_options = {uri: (doc._id || "")};
				options = jQuery.extend(default_options, options);
				
				jQuery.ajax({
					url: this.url + "/" + options.uri, 
					type: method,
					data: JSON.stringify(doc, this.functionReplacer),
					processData: false,
					contentType: 'application/json',
					dataType: 'json',
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
			},

			// ==== Post one new document ====
			// POST one document to the server, with the URI in doc._id
			// for consistency, even though it doesn't exist yet. The
			// callback is called with the response of the POST, which
			// in the case of a _temp_view is the query results.
      
			post : function SameDomainDB_post(doc, callback, options)
			{
				this._put_or_post('POST', doc, callback, options);
			},

			// ==== Put one modified document ====
			// PUT one document to the server, with the URI in doc._id
			// (because this document already exists, and we're
			// updating it). doc._rev is required by CouchDB.

			put : function SameDomainDB_put(doc, callback, options)
			{
				this._put_or_post('PUT', doc, callback, options);
			},

			// ==== Post multiple new documents ====
			// POST multiple documents to the server, with the URI
			// optionally stored in each doc._id. Documents without a
			// pre-assigned _id will be assigned one. Can optionally
			// replace any existing documents, even if their _rev is
			// not known, by executing a GET request for them first
			// to find their current rev. Uses the bulk document
			// API, http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API
						
			post_multiple : function SameDomainDB_post(docs,
				cb_after_all_posted, options)
			{
				var _options_closure = {};
				jQuery.extend(_options_closure, options);
				_options_closure.database = this;
				_options_closure.documents = docs;
				
				new Nest(
					_options_closure, // our context variable, p
					function SameDomainDB_post_multiple_identify(p, nest)
					{
						if (p.replace_existing)
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
							
							jQuery.ajax({
								type: 'POST',
								url: p.database.url + "/_all_docs",
								dataType: 'json',
								data: JSON.stringify(request),
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
									if (p.ajaxErrorHandler)
									{
										p.ajaxErrorHandler(jqXHR,
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
						jQuery.ajax({
							type: 'POST',
							url: p.database.url + "/_bulk_docs",
							contentType: 'application/json',
							dataType: 'json',
							data: JSON.stringify({docs: p.documents}),
							success: function SameDomainDB_post_multiple_id_ok(data,
								textStatus, jqXHR)
							{
								cb_after_all_posted.call(p.database,
									p.documents);
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
				) /* Nest */ .call(this);
			}, // end post() method

			// ==== Get Changes ====
			// We poll the {{{_changes}}} endpoint to get the most
			// recent documents. At the moment, we're not storing the
			// sequence numbers for each server, however this is on 
			// the TODO list.

			getChanges : function(cb)
			{
				var url = this.url + "/_changes";
				$.getJSON(url, {since : rs.seq},
					function(data)
					{
						cb(data);
	 				});
			},
      
			// ==== View ====
			// Similar to calling view() on a local database, but you should
			// specify a {{{design_doc}}} and a {{{view_name}}} in the 
			// {{{options}}}, to allow the view to be cached.
			//
			// If you do, the design document will be fetched and the map and
			// reduce functions compared with the ones that you passed to see
			// if they match, and if not the design document will be updated
			// to cache the query for future use.
			//
			// If no {{{design_doc}}} or {{{view_name}}} is specified, a
			// temporary view is created, which is expensive but good for
			// development according to the CouchDB documentation.
      
			view : function(options)
			{
				var self = this;
				
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
			}
    };

    if (cb){
      cb(rs);
    }
    
    return rs;
  }

  // === Function to sync between a source, and target database ===
  bc.sync = function(source, target, options){
    var options = options || {};
    var _sync = function(){  
      // ==== Get Changes ====
      target.getChanges(function(data){
        if (data && data.results){
          // ==== Merge new data back in ====
          // TODO, screw it, for now we'll assume the servers right.
          // - In future we need to store the conflicts in the doc
          var i = 0;
          for (var d in data.results){
            target.get(data.results[d]._id, function(doc){
              if (doc){
                source.put(doc, function(){
                  i ++;
                  if (i >= data.results.length){
                    if (options.update){
                      options.update();
                    }
                  }
                });
              }  
            })
          }
        }
      });   
      
      
      // ==== Send Changes ====
      // We'll ultimately use the bulk update methods, but for
      // now, just iterate through the queue with a req for each
      source.getChanges(function(x){
        $.each(x, function(){
          target.put(this);
        });
      });
         
    }
    
    _sync();
    
    if (options.continuous){
      var interval = setInterval(_sync, options.timeout || 3000);  
    }
  }


  // === //List All Databases// ===
  //
  // Similar to {{{/_all_dbs}}} as there is no way to see what 
  // keys are stored in localStorage, we have to store a metadata 
  // database
  //
  bc.allDbs = function(cb){
  	bc.ensureMeta(function(){
       bc._meta.get('databases', cb);
    });
  } 
  
  // === Load Metadata Database ===
  // We store metadata, such as a list of databases etc,
  // in a metadatabase. This will create a browsercouch
  // wrapper for this database unless it's already loaded
  bc.ensureMeta = function(cb, storage, options){
  	if (bc._meta || options.meta){
  		cb();
  	}else{
  		bc._meta = cons('_BrowserCouchMeta', {meta:true, storage:storage})
  		bc._meta.onload(cb);
    }
  }
  
  // == {{{BrowserCouch}}} Core Constructor ==
  //
  // {{{BrowserCouch}}} is the main object that clients will use.  It's
  // intended to be somewhat analogous to CouchDB's RESTful API.
  //
  // Returns a wrapper to the database that emulates the HTTP methods
  // available to /<database>/
  //
  var cons = function(name, options){
    var options = options || {};
    
    var self = {
      // 'private' variables - perhaps we should move these into the closure
      loaded : false,
      loadcbs : [],
      
      // ==== Sync the database ====
      // Emulates the CouchDB replication functionality
      // At the moment only couch's on the same domain
      // will work beause of XSS restrictions.
      sync : function(target, syncOpts){
        self.onload(function(){
            var cb = function(rdb){
              bc.sync(self, rdb, syncOpts);  
            };
                
            if (target.indexOf(":")>-1 && target.split(":")[0] === "BrowserCouch"){
            	options.name = target.split(":")[1];
            	options.storage = options.storage || new bc.LocalStorage();
              bc.BrowserDatabase(options, cb);
            }else{
            	options.url = target;
              bc.SameDomainDB(options, cb)
            }
            
          });
      },
      
      // ==== Add an onload function ====
      // Seeing as we're completely callback driven, and you're
      // frequently going to want to do a bunch of things once
      // the database is loaded, being able to add an arbitrary
      // number of onload functions is useful.
      // 
      // Onload functions are called with no arguments, but the 
      // database object from the constructor is now ready. 
      // (TODO - change this?)
      //
      onload : function(func){
        if (self.loaded){
          func(self);
        } else{
          self.loadcbs.push(func);
        }   
      }
      
    
    
    };
    
    var _options_closure = options;
    
    bc.ensureMeta(function(){
	    // Create a database wrapper.
      var options = _options_closure;
	    var db_class = options.db_class || bc.BrowserDatabase;

      // TODO - check local storage is available
	    options.name = name;
	    options.storage = options.storage || new bc.LocalStorage();
	    
			db_class(options,
				function(db){
					// == TODO ==
					// We're copying the resultant methods back onto
					// the self object. Could do this better.
					for (var k in db){
						self[k] = db[k];
					}  
				
					// Fire the onload callbacks
					self.loaded = true;
					for (var cbi = 0; cbi < self.loadcbs.length; cbi++)
					{
						self.loadcbs[cbi](self);
					}
				},
				options);
			}, options.storage, options);
		    
    return self;   
  }
  
  // == TODO ==
  // We're copying the bc methods onto the Database object. 
  // Need to do this better, should research the jquery object.
  for (var k in bc){
    cons[k] = bc[k];
  }
  return cons
}();  
