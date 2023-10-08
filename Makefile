####
#
# Blog HN 
#
#
.PHONY: dev

PORT=8000

dev:
	python3 -m http.server ${PORT}
