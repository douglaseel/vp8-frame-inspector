CC=gcc
CFLAGS=-Wunused-variable `pkg-config --cflags gstreamer-1.0 glib-2.0`
LDFLAGS=`pkg-config --libs gstreamer-1.0 glib-2.0`


all: build_folder out/inspector

build_folder:
	mkdir -p out/

out/inspector: src/inspector.c src/vp8_parser.c
	$(CC) -o $@ $^ $(CFLAGS) $(LDFLAGS)

clean:
	rm -rf out/
