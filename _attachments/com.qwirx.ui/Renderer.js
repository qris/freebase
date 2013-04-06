goog.provide('com.qwirx.ui.Renderer');
goog.require('goog.ui.ContainerRenderer');

/**
 * Renderer for {@link goog.ui.Component}s,
 * based on {@link goog.ui.ContainerRenderer} but without the bad
 * behaviours that assume that we're rendering a 
 * {@link goog.ui.Container}, because we're probably not.
 * @constructor
 * @extends {goog.ui.ContainerRenderer}
 */
com.qwirx.ui.Renderer = function()
{
	goog.ui.ContainerRenderer.call(this);
};
goog.inherits(com.qwirx.ui.Renderer, goog.ui.ContainerRenderer);
goog.addSingletonGetter(com.qwirx.ui.Renderer);

/**
 * Default CSS class to be applied to the root element of toolbars rendered
 * by this renderer.
 * @type {string}
 */
com.qwirx.ui.Renderer.prototype.CSS_CLASS = goog.getCssName('com_qwirx_ui');

/**
 * Returns the CSS class to be applied to the root element of containers
 * rendered using this renderer.
 * @return {string} Renderer-specific CSS class.
 */
com.qwirx.ui.Renderer.prototype.getCssClass = function()
{
	return this.CSS_CLASS;
};

/**
 * Returns all CSS class names applicable to the given container, based on its
 * state.  The array of class names returned includes the renderer's own CSS
 * class, followed by a CSS class indicating the container's orientation,
 * followed by any state-specific CSS classes.
 * @param {goog.ui.Container} container Container whose CSS classes are to be
 *     returned.
 * @return {Array.<string>} Array of CSS class names applicable to the
 *     container.
 */
com.qwirx.ui.Renderer.prototype.getClassNames = function(container)
{
	var baseClass = this.getCssClass();
	var classNames = [
		baseClass,
	];
	// Not all components have an isEnabled() method.
	/*
	if (!container.isEnabled()) {
		classNames.push(goog.getCssName(baseClass, 'disabled'));
	}
	*/
	return classNames;
};

