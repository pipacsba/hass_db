# hass_db
hass db webview

I run the home-assistant on a RaspberryPI2. To save the SD card, I placed the home-assistant recorder database to a ramdisk, with quite small amount of capacity. To be able to store the recorded parameters for a longer term, I
- copy and merge the dayly database to a remote location (hass_db_merge.py)
- and created a simple node js script to view the data similarily to the home-assistant history (hass_db_web.js)

The files can be re-used, but primarily created for my need.
I also need to admit, that this is my first node js (and js) application, so it is a bit more chaotic than I like.
