goog.provide('com.qwirx.freebase.Freebase.Gui');

goog.require('com.qwirx.freebase.Freebase');

com.qwirx.freebase.Freebase.Gui = function(database)
{
	this.fb_ = database; // new com.qwirx.freebase.Freebase(database);
	goog.events.listen(database, com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
};

// Main entry function to start the Freebase application. Takes over the
// supplied {{{container}}}, which should be a DOM element.

com.qwirx.freebase.Freebase.Gui.prototype.run = function(container)
{
	com.qwirx.loader.loadCss('com.qwirx.freebase', 'freebase.css');
	com.qwirx.loader.loadCss('goog.closure', 'common.css',
		'tab.css', 'tabbar.css', 'button.css', 'custombutton.css',
		'toolbar.css');

	goog.dom.removeChildren(container);
	this.openDocumentsById_ = {};
	this.window = container;
	this.construct();
};

com.qwirx.freebase.Freebase.Gui.prototype.construct = function()
{
	com.qwirx.loader.loadCss('goog.closure', 'tree.css');

	var treeConfig = goog.ui.tree.TreeControl.defaultConfig;
	treeConfig['cleardotPath'] = '../closure-library/closure/' +
		'goog/images/tree/cleardot.gif';
	var navigator = this.navigator_ =
		new goog.ui.tree.TreeControl('localhost', treeConfig);

	var editArea = this.editArea_ = new com.qwirx.freebase.DocumentArea();
	
    // Set up splitpane with already existing DOM.
	var splitter = this.splitter_ = new goog.ui.SplitPane(navigator,
		editArea, goog.ui.SplitPane.Orientation.HORIZONTAL);
	splitter.render(goog.dom.getElement(this.window));
	splitter.setSize(new goog.math.Size('100%',300));
	
	var editAreaDocTabs = this.editAreaDocTabs_ = new goog.ui.TabBar();
	editAreaDocTabs.render(editArea.getTabsCell());
	
	goog.events.listen(navigator, goog.events.EventType.CHANGE,
		this.onNavigatorClicked, false, this);
	
	var self = this;
	this.fb_.listAll(/* fetch document contents: */ true,
		function(results)
		{
			var len = results.rows.length;
			for (var i = 0; i < len; i++)
			{
				var result = results.rows[i];
				var newNodeName = self.getDocumentLabel(result.doc);
				var newNode = self.navigator_.createNode(newNodeName);
				newNode.setModel({id: result.id});
				self.navigator_.addChild(newNode);
			}
		});
};

com.qwirx.freebase.Freebase.treeLabelCompare = function(a, b)
{
	var ta = (a instanceof goog.ui.tree.BaseNode) ? a.getText() : a;
	var tb = (b instanceof goog.ui.tree.BaseNode) ? b.getText() : b;
	return goog.array.defaultCompare(ta, tb);
};

com.qwirx.freebase.Freebase.Gui.prototype.getDocumentLabel = function(document)
{
	return document._id;
};

com.qwirx.freebase.Freebase.Gui.prototype.onDocumentSaved = function(event)
{
	var newNodeName = this.getDocumentLabel(event.getDocument());
	var index = com.qwirx.util.Tree.treeSearch(this.navigator_,
		com.qwirx.freebase.Freebase.treeLabelCompare, newNodeName);

	if (index < 0)
	{
		// need to insert
		index = ~index;
		var newNode = this.navigator_.createNode(newNodeName);
		newNode.setModel({id: event.getDocument()._id});
		this.navigator_.addChildAt(newNode, index);
	}
	else
	{
		// node already exists, nothing to do visually		
	}
};

com.qwirx.freebase.Freebase.Gui.prototype.onNavigatorClicked = function(event)
{
	this.openDocument(this.navigator_.getSelectedItem().getModel().id,
		function onSuccess(){});
};

com.qwirx.freebase.Freebase.Gui.prototype.getEditorContainer = function()
{
	return this.editArea_.getDocCell();
};

com.qwirx.freebase.Freebase.Gui.prototype.openDocument =
	function(openedId, onSuccess, onError, view)
{
	if (view == null)
	{
		if (openedId && this.fb_.isTableId(openedId))
		{
			view = com.qwirx.freebase.InstanceListView;
		}
		else
		{
			view = com.qwirx.freebase.AutomaticFormView;
		}
	}
	
	var key = openedId + " " + view.name;
	var alreadyOpenEditor = this.openDocumentsById_[key];
	
	if (alreadyOpenEditor)
	{
		alreadyOpenEditor.activate();
		onSuccess(alreadyOpenEditor);
	}
	else
	{
		var self = this;
		return this.fb_.get(openedId,
			function onGetSuccess(document)
			{
				var editor = self.openDocumentsById_[key] =
					new view(self,
						self.fb_,
						document,
						self.getEditorContainer(),
						self.editAreaDocTabs_);
				onSuccess(editor);
			},
			function onError(exception)
			{
				self.onError(exception);
			});
	}
};

com.qwirx.freebase.Freebase.Gui.prototype.getOpenDocumentsById =
	function(documentId)
{
	var results = [];
	var searchPrefix = documentId + " ";
	
	goog.object.forEach(this.openDocumentsById_,
		function(value, key)
		{
			if (goog.string.startsWith(key, searchPrefix))
			{
				results[results.length] = value;
			}
		});
		
	return results;
};

com.qwirx.freebase.Freebase.Gui.prototype.onError = function(exception)
{
	alert(exception);
};

com.qwirx.freebase.Freebase.Gui.prototype.onDocumentClose = 
	function(documentEditor)
{
	var documentId = documentEditor.documentId_;
	var key = documentId + " " + documentEditor.constructor.name;
	if (!(key in this.openDocumentsById_))
	{
		throw new Error("Document close event reported for a " +
			"document that does not appear to be open: " +
			key);
	}
	delete this.openDocumentsById_[key];
};

