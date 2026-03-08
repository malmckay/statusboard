/*
    Network.h — WiFi connection helper for Inkplate5V2_News
    Stripped down to WiFi + NTP only; news/weather fetching moved to Cloudflare Worker.
*/

#ifndef NETWORK_H
#define NETWORK_H

#include "Arduino.h"
#include <WiFi.h>

class Network
{
  public:
    void begin(const char *ssid, const char *pass, int timeZoneOffset);
    // Reconnects if dropped; reboots after 30 s of failure
    void ensureConnected();

  private:
    char _ssid[64];
    char _pass[64];
    int  _tzOffset;
};

#endif
