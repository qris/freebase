goog.provide('com.qwirx.freebase.ClosableTab');

goog.require('goog.ui.Tab');
goog.require('com.qwirx.freebase.CloseButton');

com.qwirx.freebase.ClosableTab = function(caption)
{
	goog.ui.Tab.call(this, caption);
	this.closeButton = new com.qwirx.freebase.CloseButton();
	/*
	var closeDom = this.getDomHelper().createDom('span',
		'fb-tab-closebox ui-icon ui-icon-close', '');
	var closeButton = new goog.ui.Button(closeDom);
	this.addChild(closeButton);
	*/
};

goog.inherits(com.qwirx.freebase.ClosableTab, goog.ui.Tab);

com.qwirx.freebase.ClosableTab.prototype.createDom = function()
{
	goog.base(this, 'createDom');
	this.addChild(this.closeButton, true);
	
	goog.events.listen(this.closeButton, goog.ui.Component.EventType.ACTION,
		this.close, false, this);
};

com.qwirx.freebase.ClosableTab.prototype.close = function()
{
	var closeEvent = new goog.events.Event(goog.ui.Component.EventType.CLOSE,
		this);
	return this.dispatchEvent(closeEvent);	
};

