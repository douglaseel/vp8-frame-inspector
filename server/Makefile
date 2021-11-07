CC=gcc
CFLAGS=-Wall `pkg-config --cflags gstreamer-1.0 glib-2.0`
LDFLAGS=`pkg-config --libs gstreamer-1.0 glib-2.0`


all: build_folder out/analyzer

build_folder:
	mkdir -p out/

out/analyzer: src/analyzer/analyzer.c src/analyzer/vp8_parser.c
	$(CC) -o $@ $^ $(CFLAGS) $(LDFLAGS)

clean:
	rm -rf out/
