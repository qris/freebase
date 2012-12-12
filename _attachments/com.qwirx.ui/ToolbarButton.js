goog.provide('com.qwirx.ui.ToolbarButton');
goog.require('goog.ui.ToolbarButton');

com.qwirx.ui.ToolbarButton = function(content, opt_renderer,
	opt_domHelper)
{
	goog.ui.ToolbarButton.call(this, content, opt_renderer,
		opt_domHelper);
};

goog.inherits(com.qwirx.ui.ToolbarButton, goog.ui.ToolbarButton);

/**
 * Override {@link goog.ui.ToolbarButton.handleMouseUp} to stop
 * propagation of mouseup events, just as we do for keyboard events.
 * There doesn't seem to be any point in letting our parents have
 * another go at the mouse events. If they wanted to intercept them,
 * they should have done it in the capture phase.
 */
goog.ui.Control.prototype.handleMouseUp = function(e)
{
	if (this.isEnabled())
	{
		if (this.isAutoState(goog.ui.Component.State.HOVER))
		{
			this.setHighlighted(true);
		}
		if (this.isActive() &&
			this.performActionInternal(e) &&
			this.isAutoState(goog.ui.Component.State.ACTIVE))
		{
			this.setActive(false);
			e.preventDefault();
			e.stopPropagation();
			return true;
		}
	}
};

