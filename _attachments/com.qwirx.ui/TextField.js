// Copyright 2010 The Closure Library Authors. All Rights Reserved.
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

/**
 * @fileoverview A simple one-line edit field (HTML input element).
 * This implementation extends {@link goog.ui.Control}. Based on
 * {@link goog.ui.Textarea} code, much simplified.
 */

goog.provide('com.qwirx.ui.TextField');
goog.provide('com.qwirx.ui.TextField.EventType');

goog.require('goog.Timer');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.style');
goog.require('goog.ui.Control');
goog.require('com.qwirx.ui.TextField.Renderer');
goog.require('goog.userAgent');
goog.require('goog.userAgent.product');

/**
 * A simple one-line edit field (HTML input element). This
 * implementation extends {@link goog.ui.Control}. Based on
 * {@link goog.ui.Textarea} code, much simplified.
 *
 * @param {string} content Text to set as the text field's initial
 *     value.
 * @param {goog.ui.Textfield.Renderer=} opt_renderer Renderer used to
 *     render or decorate the textfield. Defaults to 
 *     {@link goog.ui.TextField.Renderer}.
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM hepler, used for
 *     document interaction.
 * @constructor
 * @extends {goog.ui.Control}
 */
com.qwirx.ui.TextField = function(content, opt_renderer, opt_domHelper) {
  goog.ui.Control.call(this, content, opt_renderer ||
      com.qwirx.ui.TextField.Renderer.getInstance(), opt_domHelper);

  this.setHandleMouseEvents(false);
  this.setAllowTextSelection(true);
  if (!content) {
    this.setContentInternal('');
  }
};
goog.inherits(com.qwirx.ui.TextField, goog.ui.Control);


/**
 * Whether or not textarea rendering characteristics have been discovered.
 * Specifically we determine, at runtime:
 *    If the padding and border box is included in offsetHeight.
 *    @see {com.qwirx.ui.TextField.prototype.needsPaddingBorderFix_}
 *    If the padding and border box is included in scrollHeight.
 *    @see {com.qwirx.ui.TextField.prototype.scrollHeightIncludesPadding_} and
 *    @see {com.qwirx.ui.TextField.prototype.scrollHeightIncludesBorder_}
 * TODO(user): See if we can determine com.qwirx.ui.TextField.NEEDS_HELP_SHRINKING_.
 * @type {boolean}
 * @private
 */
// com.qwirx.ui.TextField.prototype.hasDiscoveredTextareaCharacteristics_ = false;


/**
 * If a user agent doesn't correctly support the box-sizing:border-box CSS
 * value then we'll need to adjust our height calculations.
 * @see {com.qwirx.ui.TextField.prototype.discoverTextareaCharacteristics_}
 * @type {boolean}
 * @private
 */
// com.qwirx.ui.TextField.prototype.needsPaddingBorderFix_ = false;


/**
 * For storing the padding box size during enterDocument, to prevent possible
 * measurement differences that can happen after text zooming.
 * Note: runtime padding changes will cause problems with this.
 * @type {goog.math.Box}
 * @private
 */
// com.qwirx.ui.TextField.prototype.paddingBox_;


/**
 * For storing the border box size during enterDocument, to prevent possible
 * measurement differences that can happen after text zooming.
 * Note: runtime border width changes will cause problems with this.
 * @type {goog.math.Box}
 * @private
 */
// com.qwirx.ui.TextField.prototype.borderBox_;


/**
 * Constants for event names.
 * @enum {string}
 */
com.qwirx.ui.TextField.EventType = {
  // RESIZE: 'resize'
};


/**
 * @return {number} The padding plus the border box height.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.getPaddingBorderBoxHeight_ = function() {
  var paddingBorderBoxHeight = this.paddingBox_.top + this.paddingBox_.bottom +
      this.borderBox_.top + this.borderBox_.bottom;
  return paddingBorderBoxHeight;
};
*/


/**
 * Sets the TextField's value.
 * @param {*} value The value property for the TextField, will be cast
 *     to a string by the browser when setting textfield.value.
 */
com.qwirx.ui.TextField.prototype.setValue = function(value) {
  this.setContent(String(value));
};


/**
 * Gets the textarea's value.
 * @return {string} value The value of the textarea.
 */
com.qwirx.ui.TextField.prototype.getValue = function() {
  return this.getElement().value;
};


/** @override */
/*
com.qwirx.ui.TextField.prototype.setContent = function(content) {
  com.qwirx.ui.TextField.superClass_.setContent.call(this, content);
  this.resize();
};
*/


/** @override **/
com.qwirx.ui.TextField.prototype.setEnabled = function(enable) {
  com.qwirx.ui.TextField.superClass_.setEnabled.call(this, enable);
  this.getElement().disabled = !enable;
};


/** @override **/
/*
com.qwirx.ui.TextField.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
  var textarea = this.getElement();

  // Eliminates the vertical scrollbar and changes the box-sizing mode for the
  // textarea to the border-box (aka quirksmode) paradigm.
  goog.style.setStyle(textarea, {
    'overflowY': 'hidden',
    'overflowX': 'auto',
    'boxSizing': 'border-box',
    'MsBoxSizing': 'border-box',
    'WebkitBoxSizing': 'border-box',
    'MozBoxSizing': 'border-box'});

  this.paddingBox_ = goog.style.getPaddingBox(textarea);
  this.borderBox_ = goog.style.getBorderBox(textarea);

  this.getHandler().
      listen(textarea, goog.events.EventType.SCROLL, this.grow_).
      listen(textarea, goog.events.EventType.FOCUS, this.grow_).
      listen(textarea, goog.events.EventType.KEYUP, this.grow_).
      listen(textarea, goog.events.EventType.MOUSEUP, this.mouseUpListener_);

  this.resize();
};
*/


/**
 * Gets the textarea's content height + padding height + border height.
 * This is done by getting the scrollHeight and adjusting from there.
 * In the end this result is what we want the new offsetHeight to equal.
 * @return {number} The height of the textarea.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.getHeight_ = function() {
  this.discoverTextareaCharacteristics_();
  var textarea = this.getElement();
  // Accounts for a possible (though unlikely) horizontal scrollbar.
  var height = this.getElement().scrollHeight +
      this.getHorizontalScrollBarHeight_();
  if (this.needsPaddingBorderFix_) {
    height -= this.getPaddingBorderBoxHeight_();
  } else {
    if (!this.scrollHeightIncludesPadding_) {
      var paddingBox = this.paddingBox_;
      var paddingBoxHeight = paddingBox.top + paddingBox.bottom;
      height += paddingBoxHeight;
    }
    if (!this.scrollHeightIncludesBorder_) {
      var borderBox = goog.style.getBorderBox(textarea);
      var borderBoxHeight = borderBox.top + borderBox.bottom;
      height += borderBoxHeight;
    }
  }
  return height;
};
*/


/**
 * Sets the textarea's height.
 * @param {number} height The height to set.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.setHeight_ = function(height) {
  if (this.height_ != height) {
    this.height_ = height;
    this.getElement().style.height = height + 'px';
  }
};
*/


/**
 * Sets the textarea's rows attribute to be the number of newlines + 1.
 * This is necessary when the textarea is hidden, in which case scrollHeight
 * is not available.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.setHeightToEstimate_ = function() {
  var textarea = this.getElement();
  textarea.style.height = 'auto';
  var newlines = textarea.value.match(/\n/g) || [];
  textarea.rows = newlines.length + 1;
};
*/


/**
 * Gets the the height of (possibly present) horizontal scrollbar.
 * @return {number} The height of the horizontal scrollbar.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.getHorizontalScrollBarHeight_ =
    function() {
  var textarea = this.getElement();
  var height = textarea.offsetHeight - textarea.clientHeight;
  if (!this.scrollHeightIncludesPadding_) {
    var paddingBox = this.paddingBox_;
    var paddingBoxHeight = paddingBox.top + paddingBox.bottom;
    height -= paddingBoxHeight;
  }
  if (!this.scrollHeightIncludesBorder_) {
    var borderBox = goog.style.getBorderBox(textarea);
    var borderBoxHeight = borderBox.top + borderBox.bottom;
    height -= borderBoxHeight;
  }
  // Prevent negative number results, which sometimes show up.
  return height > 0 ? height : 0;
};
*/


/**
 * In order to assess the correct height for a textarea, we need to know
 * whether the scrollHeight (the full height of the text) property includes
 * the values for padding and borders. We can also test whether the
 * box-sizing: border-box setting is working and then tweak accordingly.
 * Instead of hardcoding a list of currently known behaviors and testing
 * for quirksmode, we do a runtime check out of the flow. The performance
 * impact should be very small.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.discoverTextareaCharacteristics_ = function() {
  if (!this.hasDiscoveredTextareaCharacteristics_) {
    var textarea = /** @type {!Element} * / (this.getElement().cloneNode(false));
    // We need to overwrite/write box model specific styles that might
    // affect height.
    goog.style.setStyle(textarea, {
      'position': 'absolute',
      'height': 'auto',
      'top': '-9999px',
      'margin': '0',
      'padding': '1px',
      'border': '1px solid #000',
      'overflow': 'hidden'
    });
    goog.dom.appendChild(this.getDomHelper().getDocument().body, textarea);
    var initialScrollHeight = textarea.scrollHeight;

    textarea.style.padding = '10px';
    var paddingScrollHeight = textarea.scrollHeight;
    this.scrollHeightIncludesPadding_ = paddingScrollHeight >
        initialScrollHeight;

    initialScrollHeight = paddingScrollHeight;
    textarea.style.borderWidth = '10px';
    var borderScrollHeight = textarea.scrollHeight;
    this.scrollHeightIncludesBorder_ = borderScrollHeight > initialScrollHeight;

    // Tests if border-box sizing is working or not.
    textarea.style.height = '100px';
    var offsetHeightAtHeight100 = textarea.offsetHeight;
    if (offsetHeightAtHeight100 != 100) {
      this.needsPaddingBorderFix_ = true;
    }

    goog.dom.removeNode(textarea);
    this.hasDiscoveredTextareaCharacteristics_ = true;
  }
};
*/


/**
 * Resizes the textarea to grow/shrink to match its contents.
 * @param {goog.events.Event=} opt_e The browser event.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.grow_ = function(opt_e) {
  if (this.isResizing_) {
    return;
  }
  var shouldCallShrink = false;
  this.isResizing_ = true;
  var textarea = this.getElement();
  var oldHeight = this.height_;
  if (textarea.scrollHeight) {
    var setMinHeight = false;
    var setMaxHeight = false;
    var newHeight = this.getHeight_();
    var currentHeight = textarea.offsetHeight;
    var minHeight = this.getMinHeight_();
    var maxHeight = this.getMaxHeight_();
    if (minHeight && newHeight < minHeight) {
      this.setHeight_(minHeight);
      setMinHeight = true;
    } else if (maxHeight && newHeight > maxHeight) {
      this.setHeight_(maxHeight);
      // If the content is greater than the height, we'll want the vertical
      // scrollbar back.
      textarea.style.overflowY = '';
      setMaxHeight = true;
    } else if (currentHeight != newHeight) {
      this.setHeight_(newHeight);
    // Makes sure that height_ is at least set.
    } else if (!this.height_) {
      this.height_ = newHeight;
    }
    if (!setMinHeight && !setMaxHeight &&
        com.qwirx.ui.TextField.NEEDS_HELP_SHRINKING_) {
      shouldCallShrink = true;
    }
  } else {
    this.setHeightToEstimate_();
  }
  this.isResizing_ = false;

  if (shouldCallShrink) {
    this.shrink_();
  }
  if (oldHeight != this.height_) {
    this.dispatchEvent(com.qwirx.ui.TextField.EventType.RESIZE);
  }
};
*/


/**
 * Resizes the texarea to shrink to fit its contents. The way this works is
 * by increasing the padding of the textarea by 1px (it's important here that
 * we're in box-sizing: border-box mode). If the size of the textarea grows,
 * then the box is filled up to the padding box with text.
 * If it doesn't change, then we can shrink.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.shrink_ = function() {
  var textarea = this.getElement();
  if (!this.isResizing_) {
    this.isResizing_ = true;
    var isEmpty = false;
    if (!textarea.value) {
      // Prevents height from becoming 0.
      textarea.value = ' ';
      isEmpty = true;
    }
    var scrollHeight = textarea.scrollHeight;
    if (!scrollHeight) {
      this.setHeightToEstimate_();
    } else {
      var currentHeight = this.getHeight_();
      var minHeight = this.getMinHeight_();
      var maxHeight = this.getMaxHeight_();
      if (!(minHeight && currentHeight <= minHeight) &&
          !(maxHeight && currentHeight >= maxHeight)) {
        // Nudge the padding by 1px.
        var paddingBox = this.paddingBox_;
        textarea.style.paddingBottom = paddingBox.bottom + 1 + 'px';
        var heightAfterNudge = this.getHeight_();
        // If the one px of padding had no effect, then we can shrink.
        if (heightAfterNudge == currentHeight) {
          textarea.style.paddingBottom = paddingBox.bottom + scrollHeight +
              'px';
          textarea.scrollTop = 0;
          var shrinkToHeight = this.getHeight_() - scrollHeight;
          if (shrinkToHeight >= minHeight) {
            this.setHeight_(shrinkToHeight);
          } else {
            this.setHeight_(minHeight);
          }
        }
        textarea.style.paddingBottom = paddingBox.bottom + 'px';
      }
    }
    if (isEmpty) {
      textarea.value = '';
    }
    this.isResizing_ = false;
  }
};
*/


/**
 * We use this listener to check if the textarea has been natively resized
 * and if so we reset minHeight so that we don't ever shrink smaller than
 * the user's manually set height. Note that we cannot check size on mousedown
 * and then just compare here because we cannot capture mousedown on
 * the textarea resizer, while mouseup fires reliably.
 * @param {goog.events.BrowserEvent} e The mousedown event.
 * @private
 */
/*
com.qwirx.ui.TextField.prototype.mouseUpListener_ = function(e) {
  var textarea = this.getElement();
  var height = textarea.offsetHeight;

  // This solves for when the MSIE DropShadow filter is enabled,
  // as it affects the offsetHeight value, even with MsBoxSizing:border-box.
  if (textarea['filters'] && textarea['filters'].length) {
    var dropShadow =
        textarea['filters']['item']('DXImageTransform.Microsoft.DropShadow');
    if (dropShadow) {
      height -= dropShadow['offX'];
    }
  }

  if (height != this.height_) {
    this.minHeight_ = height;
    this.height_ = height;
  }
};
*/

goog.provide('com.qwirx.ui.TextField.Renderer');

goog.require('goog.ui.Component.State');
goog.require('goog.ui.ControlRenderer');


/**
 * Renderer for {@link com.qwirx.ui.TextField}s. Renders and decorates
 * native HTML input elements.  Since these elements have built-in 
 * support for many features, overrides many expensive (and redundant) 
 * superclass methods to be no-ops.
 * @constructor
 * @extends {goog.ui.ControlRenderer}
 */
com.qwirx.ui.TextField.Renderer = function() {
  goog.ui.ControlRenderer.call(this);
};
goog.inherits(com.qwirx.ui.TextField.Renderer, goog.ui.ControlRenderer);
goog.addSingletonGetter(com.qwirx.ui.TextField.Renderer);


/**
 * Default CSS class to be applied to the root element of components rendered
 * by this renderer.
 * @type {string}
 */
com.qwirx.ui.TextField.Renderer.CSS_CLASS = goog.getCssName('fb-textfield');


/** @override */
com.qwirx.ui.TextField.Renderer.prototype.getAriaRole = function() {
  // input elements don't need ARIA roles to be recognized by screen 
  // readers.
  return undefined;
};


/** @override */
com.qwirx.ui.TextField.Renderer.prototype.decorate = function(control, element) {
  this.setUpTextarea_(control);
  com.qwirx.ui.TextField.Renderer.superClass_.decorate.call(this, control,
      element);
  control.setContent(element.value);
  return element;
};


/**
 * Returns the textarea's contents wrapped in an HTML textarea element.  Sets
 * the textarea's disabled attribute as needed.
 * @param {goog.ui.Control} textarea Textarea to render.
 * @return {Element} Root element for the Textarea control (an HTML textarea
 *     element).
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.createDom = function(textfield) {
  this.setUpTextarea_(textfield);
  var element = textfield.getDomHelper().createDom('input', {
    'type': 'text',
    'class': this.getClassNames(textfield).join(' '),
    'disabled': !textfield.isEnabled()
  }, textfield.getContent() || '');
  return element;
};


/**
 * Overrides {@link goog.ui.ControlRenderer#canDecorate} by returning true only
 * if the element is an HTML textarea.
 * @param {Element} element Element to decorate.
 * @return {boolean} Whether the renderer can decorate the element.
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.canDecorate = function(element) {
  return element.tagName == goog.dom.TagName.INPUT;
};


/**
 * Textareas natively support right-to-left rendering.
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.setRightToLeft = goog.nullFunction;


/**
 * Textareas are always focusable as long as they are enabled.
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.isFocusable = function(textfield) {
  return textfield.isEnabled();
};


/**
 * Textareas natively support keyboard focus.
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.setFocusable = goog.nullFunction;


/**
 * Textareas also expose the DISABLED state in the HTML textarea's
 * <code>disabled</code> attribute.
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.setState = function(textfield, state,
    enable) {
  com.qwirx.ui.TextField.Renderer.superClass_.setState.call(this,
    textfield, state, enable);
  var element = textfield.getElement();
  if (element && state == goog.ui.Component.State.DISABLED) {
    element.disabled = enable;
  }
};


/**
 * Textareas don't need ARIA states to support accessibility, so this is
 * a no-op.
 * @override
 */
com.qwirx.ui.TextField.Renderer.prototype.updateAriaState = goog.nullFunction;


/**
 * Sets up the textarea control such that it doesn't waste time adding
 * functionality that is already natively supported by browser
 * textareas.
 * @param {com.qwirx.ui.TextField} textfield TextField control to
 *     configure.
 * @private
 */
com.qwirx.ui.TextField.Renderer.prototype.setUpTextarea_ = function(textfield) {
  textfield.setHandleMouseEvents(false);
  textfield.setAutoStates(goog.ui.Component.State.ALL, false);
  textfield.setSupportedState(goog.ui.Component.State.FOCUSED, false);
};


/** @override **/
com.qwirx.ui.TextField.Renderer.prototype.setContent = function(element, value) {
  if (element) {
    element.value = value;
  }
};


/** @override **/
com.qwirx.ui.TextField.Renderer.prototype.getCssClass = function() {
  return com.qwirx.ui.TextField.Renderer.CSS_CLASS;
};

