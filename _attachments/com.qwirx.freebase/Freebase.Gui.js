goog.provide('com.qwirx.freebase.Freebase.Gui');

goog.require('com.qwirx.freebase.Freebase');
goog.require('com.qwirx.ui.BorderLayout');
goog.require('goog.ui.Component');

/**
 * The entire Freebase GUI as a component.
 *
 * @param {com.qwirx.freebase.Freebase} database The database that
 * this GUI will be attached to, and use as the source of database
 * objects.
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @param {goog.ui.ContainerRenderer=} opt_renderer Renderer used to
 * render or decorate the container; defaults to
 * {@link com.qwirx.freebase.Freebase.Gui.Renderer}.
 * @constructor
 * @extends {goog.ui.Component}
 */
com.qwirx.freebase.Freebase.Gui = function(database, opt_domHelper,
	opt_renderer)
{
	goog.ui.Component.call(this, opt_domHelper);
	
	this.renderer_ = opt_renderer ||
		com.qwirx.freebase.Freebase.Gui.Renderer.getInstance();

	this.fb_ = database; // new com.qwirx.freebase.Freebase(database);
	this.openDocumentsById_ = {};
	goog.events.listen(database, com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
	goog.events.listen(this, com.qwirx.freebase.EditorClosed.EVENT_TYPE,
		this.onEditorClosed, false, this);

	this.layout_ = new com.qwirx.ui.BorderLayout(this.getDomHelper());
	
	var treeConfig = goog.ui.tree.TreeControl.defaultConfig;
	treeConfig['cleardotPath'] = '../closure-library/closure/' +
		'goog/images/tree/cleardot.gif';
	var navigator = this.navigator_ =
		new goog.ui.tree.TreeControl('localhost', treeConfig,
		this.getDomHelper());

	var editArea = this.editArea_ =
		new com.qwirx.freebase.DocumentArea(this.getDomHelper());
	
    // Set up splitpane with already existing DOM.
	var splitter = this.splitter_ = new goog.ui.SplitPane(navigator,
		editArea, goog.ui.SplitPane.Orientation.HORIZONTAL);
	
	goog.events.listen(navigator, goog.events.EventType.CHANGE,
		this.onNavigatorClicked, false, this);
	
	goog.events.listen(this, com.qwirx.util.ExceptionEvent.EVENT_TYPE,
		function(event)
		{
			alert("An unexpected error occurred: " +
				event.getException().message);
		});
};
goog.inherits(com.qwirx.freebase.Freebase.Gui, goog.ui.Component);

/**
 * Freebase.Gui cannot be used to decorate pre-existing html, since the
 * structure it builds is fairly complicated.
 * @param {Element} element Element to decorate.
 * @return {boolean} Always returns false.
 * @override
 */
/*
com.qwirx.freebase.Freebase.Gui.prototype.canDecorate = function(element)
{
	return false;
};
*/

/**
 * Creates the container's DOM using the renderer, instead of ignoring it
 * like the inherited createDom(). We also add the newly created child
 * components here.
 * @see https://groups.google.com/forum/?fromgroups=#!topic/closure-library-discuss/x3kR1CJHveQ
 * @override
 */
com.qwirx.freebase.Freebase.Gui.prototype.createDom = function()
{
	// Delegate to renderer.
	var elem = this.renderer_.createDom(this);
	elem.style.height = "100%";
	elem.style.width = "100%";
	this.setElementInternal(elem);

	this.addChild(this.layout_, true);
	this.layout_.addChild(this.splitter_, true);
};

com.qwirx.freebase.Freebase.Gui.prototype.enterDocument = function()
{
	goog.base(this, 'enterDocument');

	com.qwirx.loader.loadCss('com.qwirx.freebase', 'freebase.css');
	com.qwirx.loader.loadCss('goog.closure', 'common.css',
		'tab.css', 'tabbar.css', 'button.css', 'custombutton.css',
		'toolbar.css', 'tree.css');

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

/**
  * Set the size of the GUI.  This is usually called by the controlling
  * application.  This will set the BorderBoxSize of the layout_.
  * @param {goog.math.Size} size The size to set the splitpane.
  */
com.qwirx.freebase.Freebase.Gui.prototype.setSize = function(size)
{
	goog.style.setBorderBoxSize(this.getElement(), size);
	this.layout_.setSize(size);
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
		this.editArea_.activate(alreadyOpenEditor);
		onSuccess(alreadyOpenEditor);
	}
	else
	{
		var self = this;
		return this.fb_.get(openedId,
			function onGetSuccess(document)
			{
				var editor = self.openDocumentsById_[key] =
					new view(self, self.fb_, document);
				self.editArea_.addChild(editor, true);
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

com.qwirx.freebase.Freebase.Gui.prototype.onEditorClosed = 
	function(event)
{
	var documentId = event.target.documentId_;
	var key = documentId + " " + event.target.constructor.name;
	if (!(key in this.openDocumentsById_))
	{
		throw new Error("Editor close event reported for an " +
			"editor that does not appear to be open: " +
			key);
	}
	delete this.openDocumentsById_[key];
};

goog.provide('com.qwirx.freebase.Freebase.Gui.Renderer');
goog.require('com.qwirx.ui.Renderer');

/**
 * Default renderer for {@link com.qwirx.freebase.Freebase.Gui}s,
 * based on {@link goog.ui.ContainerRenderer}.
 * @constructor
 * @extends {goog.ui.ContainerRenderer}
 */
com.qwirx.freebase.Freebase.Gui.Renderer = function() {
	goog.base(this);
};
goog.inherits(com.qwirx.freebase.Freebase.Gui.Renderer,
	com.qwirx.ui.Renderer);
goog.addSingletonGetter(com.qwirx.freebase.Freebase.Gui.Renderer);

/**
 * Default CSS class to be applied to the root element of toolbars rendered
 * by this renderer.
 * @type {string}
 */
com.qwirx.freebase.Freebase.Gui.Renderer.prototype.CSS_CLASS =
	goog.getCssName('com_qwirx_freebase_Freebase_Gui');

