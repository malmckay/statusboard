/*
    Network.cpp — WiFi connection helper for Inkplate5V2_News
*/

#include "Network.h"

void Network::begin(const char *ssid, const char *pass, int timeZoneOffset)
{
    strncpy(_ssid, ssid, sizeof(_ssid) - 1);
    strncpy(_pass, pass, sizeof(_pass) - 1);
    _tzOffset = timeZoneOffset;

    WiFi.mode(WIFI_STA);
    WiFi.begin(_ssid, _pass);
    Serial.print(F("Connecting to WiFi"));
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 30000UL)
    {
        delay(500);
        Serial.print('.');
    }
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println(F("\nWiFi failed — rebooting"));
        delay(100);
        ESP.restart();
    }
    Serial.println(F("\nWiFi connected."));
}

void Network::ensureConnected()
{
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.println(F("WiFi dropped — reconnecting"));
    WiFi.reconnect();
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 30000UL)
    {
        delay(500);
        Serial.print('.');
    }
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println(F("\nReconnect failed — rebooting"));
        delay(100);
        ESP.restart();
    }
    Serial.println(F("\nReconnected."));
}
