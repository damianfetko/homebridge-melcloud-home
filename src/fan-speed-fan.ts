import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MELCloudHomePlatform } from './platform';
import { AirToAirUnit, MELCloudAPI } from './melcloud-api';

/**
 * Fan Speed Fan - A virtual fan device for controlling AC fan speed
 *
 * Similar to Home Assistant template fan:
 * - Active: AC is powered on AND fan speed is not Auto
 * - Inactive: AC is off OR fan speed is Auto
 * - Percentage: Maps fan speeds 1-5 to percentages (0=auto, 20=1, 40=2, 60=3, 80=4, 100=5)
 * - Turn on: Sets fan speed to 5 (max)
 * - Turn off: Sets fan speed to Auto
 */
export class FanSpeedFan {
  private service: Service;
  private device: AirToAirUnit;

  // Fan speed mapping
  static readonly SPEED_COUNT = 5;

  // Map percentage to fan speed (0% = Auto)
  static percentageToFanSpeed(percentage: number): string {
    if (percentage === 0) {
      return 'Auto';
    } else if (percentage <= 20) {
      return 'One';
    } else if (percentage <= 40) {
      return 'Two';
    } else if (percentage <= 60) {
      return 'Three';
    } else if (percentage <= 80) {
      return 'Four';
    } else {
      return 'Five';
    }
  }

  // Map fan speed to percentage
  static fanSpeedToPercentage(fanSpeed: string): number {
    // Normalize speed values
    const normalizedSpeed = fanSpeed.toLowerCase();
    
    if (normalizedSpeed === 'auto' || normalizedSpeed === '0') {
      return 0;
    } else if (normalizedSpeed === 'one' || normalizedSpeed === '1') {
      return 20;
    } else if (normalizedSpeed === 'two' || normalizedSpeed === '2') {
      return 40;
    } else if (normalizedSpeed === 'three' || normalizedSpeed === '3') {
      return 60;
    } else if (normalizedSpeed === 'four' || normalizedSpeed === '4') {
      return 80;
    } else if (normalizedSpeed === 'five' || normalizedSpeed === '5') {
      return 100;
    }
    return 0; // Default to Auto
  }

  constructor(
    private readonly platform: MELCloudHomePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Mitsubishi Electric')
      .setCharacteristic(this.platform.Characteristic.Model, 'MELCloud Fan Control')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.device.connectedInterfaceIdentifier}-fan-control`);

    // Get or create the Fan service (Fanv2)
    this.service = this.accessory.getService(this.platform.Service.Fanv2) ||
      this.accessory.addService(this.platform.Service.Fanv2);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      `${this.device.givenDisplayName} Fan`,
    );

    // Active (on/off)
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Rotation Speed (percentage)
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 20, // 5 steps: 0%, 20%, 40%, 60%, 80%, 100%
      })
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));
  }

  private getSettings() {
    return MELCloudAPI.parseSettings(this.device.settings);
  }

  async getActive(): Promise<CharacteristicValue> {
    const settings = this.getSettings();
    const isPowerOn = settings.Power === 'True';
    const fanSpeed = settings.SetFanSpeed;
    const isAuto = fanSpeed === 'Auto' || fanSpeed === '0';

    // Active = AC is on AND fan is not Auto
    const isActive = isPowerOn && !isAuto;
    
    this.platform.debugLog(
      `[${this.device.givenDisplayName} Fan] Get Active: ${isActive} (power=${isPowerOn}, fanSpeed=${fanSpeed})`,
    );
    
    return isActive ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    const isActive = value === this.platform.Characteristic.Active.ACTIVE;
    
    this.platform.log.info(`[${this.device.givenDisplayName} Fan] Set Active: ${isActive}`);

    if (isActive) {
      // Turn on: Set fan speed to 5 (max)
      await this.setFanSpeed('Five');
    } else {
      // Turn off: Set fan speed to Auto
      await this.setFanSpeed('Auto');
    }
  }

  async getRotationSpeed(): Promise<CharacteristicValue> {
    const settings = this.getSettings();
    const fanSpeed = settings.SetFanSpeed;
    const percentage = FanSpeedFan.fanSpeedToPercentage(fanSpeed);
    
    this.platform.debugLog(
      `[${this.device.givenDisplayName} Fan] Get RotationSpeed: ${percentage}% (fanSpeed=${fanSpeed})`,
    );
    
    return percentage;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    const percentage = value as number;
    const fanSpeed = FanSpeedFan.percentageToFanSpeed(percentage);
    
    this.platform.log.info(
      `[${this.device.givenDisplayName} Fan] Set RotationSpeed: ${percentage}% (fanSpeed=${fanSpeed})`,
    );

    await this.setFanSpeed(fanSpeed);
  }

  private async setFanSpeed(fanSpeed: string) {
    const settings = this.getSettings();

    this.platform.debugLog(
      `[${this.device.givenDisplayName} Fan] Setting fan=${fanSpeed}, preserving vane=${settings.VaneVerticalDirection}`,
    );

    try {
      await this.platform.getAPI().controlDevice(this.device.id, {
        power: true, // Always power on when setting fan speed
        operationMode: settings.OperationMode,
        setFanSpeed: fanSpeed,
        vaneHorizontalDirection: settings.VaneHorizontalDirection,
        vaneVerticalDirection: settings.VaneVerticalDirection,
        setTemperature: Number.parseFloat(settings.SetTemperature),
        temperatureIncrementOverride: null,
        inStandbyMode: null,
      });

      // Update cached state
      const updatedSettings = this.device.settings.map(setting => {
        if (setting.name === 'SetFanSpeed') {
          return { ...setting, value: fanSpeed };
        }
        if (setting.name === 'Power') {
          return { ...setting, value: 'True' };
        }
        return setting;
      });
      this.device.settings = updatedSettings;

      // Update this fan's state immediately
      this.updateFromDevice(this.device);

      // Schedule a full refresh to sync with API
      this.platform.scheduleRefresh();
    } catch (error) {
      this.platform.log.error(`[${this.device.givenDisplayName} Fan] Failed to set speed:`, error);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  // Update from device state (called by platform refresh)
  public updateFromDevice(device: AirToAirUnit) {
    this.device = device;
    this.accessory.context.device = device;

    const settings = this.getSettings();
    const isPowerOn = settings.Power === 'True';
    const fanSpeed = settings.SetFanSpeed;
    const isAuto = fanSpeed === 'Auto' || fanSpeed === '0';
    const isActive = isPowerOn && !isAuto;
    const percentage = FanSpeedFan.fanSpeedToPercentage(fanSpeed);

    // Update Active state
    const currentActive = this.service.getCharacteristic(this.platform.Characteristic.Active).value;
    const targetActive = isActive 
      ? this.platform.Characteristic.Active.ACTIVE 
      : this.platform.Characteristic.Active.INACTIVE;
    
    if (targetActive !== currentActive) {
      this.platform.debugLog(
        `[${this.device.givenDisplayName} Fan] Update Active: ${currentActive} -> ${targetActive}`,
      );
      this.service.updateCharacteristic(this.platform.Characteristic.Active, targetActive);
    }

    // Update Rotation Speed
    const currentSpeed = this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).value;
    if (percentage !== currentSpeed) {
      this.platform.debugLog(
        `[${this.device.givenDisplayName} Fan] Update RotationSpeed: ${currentSpeed}% -> ${percentage}%`,
      );
      this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, percentage);
    }
  }
}
