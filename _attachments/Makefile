all: dep docs

dep: calculated_deps.js

.PHONY: calculated_deps.js
calculated_deps.js: .
	closure-library/closure/bin/calcdeps.py -o deps --output_file=calculated_deps.js

JSDOC_BASE = ../../jsdoc_toolkit-2.4.0/jsdoc-toolkit
JSDOC_APP  = $(JSDOC_BASE)/app
# JSDOC_TMPL = $(JSDOC_BASE)/templates/jsdoc
JSDOC_TMPL = jsdoc/templates/default
JSDOC_DEST = jsdocs

JSDOC_PROPS = "-Djsdoc.dir=$(JSDOC_BASE)"
# JSDOC_PROPS += "-Djsdoc.template.dir=doc.template"

.PHONY: docs
docs:
	./jsdoc/jsdoc -t "$(JSDOC_TMPL)" -d "$(JSDOC_DEST)" com.qwirx.*

.PHONY: tests
tests:
	echo 'var _allTests = [$(shell find com.qwirx.* -name '*_test.html' \
		| sed -e 's/\(.*\)/"\1",/')];' > tests.js
