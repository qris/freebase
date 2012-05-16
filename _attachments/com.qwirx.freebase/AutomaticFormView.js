goog.provide('com.qwirx.freebase.AutomaticFormView');

com.qwirx.freebase.FLASH_RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-flash');

com.qwirx.freebase.AutomaticFormView = function(gui, freebase, document,
	editarea, opt_tabbar)
{
	com.qwirx.freebase.DocumentEditor.call(this, gui, freebase,
		document, editarea, opt_tabbar);

	var editorControl = this.editorControl_;

	// auto-render something usable
	editorControl.className += ' fb-docedit-autoform';
	var controls = this.autoFormControls_ = {};
	this.autoFormFixedCells_ = {}

	var dom = goog.dom.getDomHelper();
	
	var flash = this.autoFormFlash_ = new goog.ui.Control('',
		com.qwirx.freebase.FLASH_RENDERER, dom);
	flash.render(editorControl);
	flash.setVisible(false);
	
	var table = this.autoFormTable_ = dom.createDom('table',
		'fb-doc-auto');
	editorControl.appendChild(table);
	
	var fields = goog.object.getKeys(this.document_).sort();
	var l = fields.length;
	
	for (var i = 0; i < l; i++)
	{
		var fieldName = fields[i];
		this.createAutoFormRow_(fieldName);
	}
	
	var submit = this.submitButton_ = new goog.ui.CustomButton('Save');
	submit.render(editorControl);
	goog.events.listen(submit, goog.ui.Component.EventType.ACTION,
		this.onSaveClicked, false, this);
};

goog.inherits(com.qwirx.freebase.AutomaticFormView,
	com.qwirx.freebase.DocumentEditor);

com.qwirx.freebase.AutomaticFormView.prototype.createAutoFormRow_ =
	function(fieldName)
{
	var document = this.document_;
	var editorControl = this.editorControl_;
	var table = this.autoFormTable_;
	var formControls = this.autoFormControls_;
	var inputAttribs = {value: document[fieldName]};
	var dom = goog.dom.getDomHelper();
	var tr;

	if (!document.hasOwnProperty(fieldName))
	{
		// ignore inherited properties such as methods
	}
	else if (fieldName.indexOf('_') == 0)
	{
		// create _id and _rev document attributes as
		// hidden fields
		inputAttribs.type = 'hidden';
		var input = formControls[fieldName] = dom.createDom('input',
			inputAttribs);
		editorControl.appendChild(input);
		
		tr = dom.createDom('tr', 'fb-row');

		var th = dom.createDom('th', 'fb-row-heading', fieldName);
		tr.appendChild(th);
	
		var td = this.autoFormFixedCells_[fieldName] = dom.createDom('td',
			'fb-row-value', document[fieldName]);
		tr.appendChild(td);
	}
	else if (fieldName.indexOf(com.qwirx.freebase.Freebase.INTERNAL_FIELD_PREFIX) == 0)
	{
		// ignore internal fields, don't allow changing them
	}
	else
	{
		tr = dom.createDom('tr', 'fb-row');

		/*
		var column = undefined;
		var l = document.constructor.columns.length;
		for (var c = 0; c < l; c++)
		{
			if (document.constructor.columns[c].name == i)
			{
				column = document.constructor.columns[c];
			}
		}
		*/
		
		var th = dom.createDom('th', 'fb-row-heading', fieldName);
		tr.appendChild(th);
		
		var td = dom.createDom('td', 'fb-row-value');
		tr.appendChild(td);
		
		inputAttribs.type = 'text';
		var input = formControls[fieldName] =
			dom.createDom('input', inputAttribs);
		td.appendChild(input);
	}

	if (tr)
	{
		table.appendChild(tr);
	}				
};

com.qwirx.freebase.AutomaticFormView.prototype.onSaveClicked = function(event)
{
	var controls = this.autoFormControls_;
	var columns = this.document_.constructor.columns;
	var l = columns.length;
	var columnsByName = {};
	
	for (var c = 0; c < l; c++)
	{
		var column = columns[c];
		columnsByName[column.name] = column;
	}
	
	var newDoc = this.document_ = goog.object.clone(this.document_);
	
	for (var i in controls)
	{
		var value = controls[i].value;
		var column = columnsByName[i];
		if (column)
		{
			if (column.type == 'Number')
			{
				value = Number(value);
			}
		}
		newDoc[i] = value;
	}
	
	newDoc = this.freebase_.instantiateModel_(newDoc);
	this.document_ = newDoc;
	
	var flash = this.autoFormFlash_;
	
	this.freebase_.save(newDoc,
		function onSuccess(object)
		{
			flash.removeClassName('fb-error-flash');
			flash.addClassName('fb-success-flash');
			flash.setContent('Document saved.');
			flash.setVisible(true);
		},
		function onError(error)
		{
			flash.removeClassName('fb-success-flash');
			flash.addClassName('fb-error-flash');
			flash.setContent('Failed to save document: ' + error);
			flash.setVisible(true);
		});
};

/**
 * Event handler for global DocumentSaved events fired at the
 * database, which updates the grid if a document is modified or
 * created which the grid should display.
 */
com.qwirx.freebase.AutomaticFormView.prototype.onDocumentSaved = function(event)
{
	var document = event.getDocument();
	var controls = this.autoFormControls_;
	this.document_ = document;
	
	for (var i in controls)
	{
		controls[i].value = document[i];
	}
	
	for (var i in this.autoFormFixedCells_)
	{
		this.autoFormFixedCells_[i].innerHTML =
			goog.string.htmlEscape(document[i]);
	}
};

