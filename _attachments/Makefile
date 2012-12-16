all: dep docs

dep: calculated_deps.js

calculated_deps.js: .
	closure-library/closure/bin/calcdeps.py -o deps --output_file=calculated_deps.js

JSDOC_BASE = ../../jsdoc_toolkit-2.4.0/jsdoc-toolkit
JSDOC_APP  = $(JSDOC_BASE)/app
# JSDOC_TMPL = $(JSDOC_BASE)/templates/jsdoc
JSDOC_TMPL = com.qwirx.jsdoc.template
JSDOC_DEST = jsdocs

JSDOC_PROPS = "-Djsdoc.dir=$(JSDOC_BASE)"
# JSDOC_PROPS += "-Djsdoc.template.dir=doc.template"

.PHONY: docs
docs:
	java $(JSDOC_PROPS) -jar "$(JSDOC_BASE)/jsrun.jar" "$(JSDOC_APP)/run.js" \
		-t="$(JSDOC_TMPL)" -d="$(JSDOC_DEST)" com.qwirx.*
