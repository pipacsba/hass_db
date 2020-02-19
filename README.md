# hass_db
hass db webview

I run the home-assistant on a RaspberryPI2. To save the SD card, I placed the home-assistant recorder database to a ramdisk, with quite small amount of capacity. To be able to store the recorded parameters for a longer term, I
1) copy and merge the daily database to a remote location (hass_db_merge.py)
2)a) and created a simple node js script to view the data similarily to the home-assistant history (hass_db_web.js)
2)b) and created a simple node js script to view the data similarily to the home-assistant history (server.js + index.html)
2)c) and created a simple node js script to view the data similarily to the home-assistant history (server.py + index.html)

The files can be re-used, but primarily created for my need.
I also need to admit, that this is my first node js (and js) application, so it is a bit more chaotic than I like.

Goal of 2)b) is to put more effort to be done on the client (as in my case the server has much less computing power then the client)
Goal of 2)c) is the same as 2)b), but the server side is written in python (as the required python packages are part of most linux installation, while node.js is not)
Currently 1) and 2)c) solutions planned to be maintained.
