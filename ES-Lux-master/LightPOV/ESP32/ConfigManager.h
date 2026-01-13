#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <EEPROM.h>
#include "config.h"

#define EEPROM_SIZE 1024
#define CONFIG_MAGIC 0xDEADBEEF

struct ConfigData {
    uint32_t magic;
    uint8_t lux_id;
    uint16_t num_pixels;
    char ssid[3][32];
    char password[3][64];
    char request_url[64];
    char time_check_url[64];
};

class ConfigManager {
public:
    ConfigData data;

    void begin();
    void save();
    void load();
    void resetToDefaults();
};

extern ConfigManager configManager;

#endif
