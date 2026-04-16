import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Switch, Modal } from 'react-native';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SquarePen, X } from 'lucide-react-native';
import { CreateEventDetails } from './CreateEventDetails';
import { TimeDropdown } from './DropdownEventTime';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EventOptions {
  location: string;
  startTime: Date | null;
  endTime: Date | null;
  dateSpecificOptions?: Record<string, DateSpecificOptions>;
}

interface DateSpecificOptions {
  location: string;
  startTime: Date | null;
  endTime: Date | null;
}

interface DateReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onFinalize: (eventOptions: EventOptions) => void;
  selectedDates: Date[];
  eventOptions: EventOptions;
  defaultLocation: string;
  pollId?: string;
  eventName: string;
  eventDescription: string;
  eventLocation: string;
  defaultEventName: string;
  onEventDetailsSave: (name: string, description: string, location: string) => void;
}

type TimeParts = { h: string; m: string; p: 'AM' | 'PM' };

interface TimeRowProps {
  label: string;
  parts: TimeParts;
  onChange: (p: TimeParts) => void;
  onClear: () => void;
  error?: string;
  small?: boolean;
  touchTargets: any;
  styles: any;
  colors: any;
  typography: any;
  saveAttempted: boolean;
}

// ============================================================================
// PURE UTILITY FUNCTIONS
// ============================================================================

const timePartsToDate = (h: string, m: string, p: 'AM' | 'PM', baseDate: Date): Date | null => {
  const hour = parseInt(h, 10);
  const minute = parseInt(m, 10);
  if (isNaN(hour) || isNaN(minute) || hour < 1 || hour > 12 || ![0, 15, 30, 45].includes(minute)) return null;
  let hour24 = hour % 12;
  if (p === 'PM') hour24 += 12;
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour24, minute);
};

const dateToTimeParts = (date: Date | null): TimeParts => {
  if (!date) return { h: '', m: '', p: 'AM' };
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;

  // Round minutes to nearest supported value (0, 15, 30, 45)
  const minutes = date.getMinutes();
  const supportedMinutes = [0, 15, 30, 45];
  const roundedMinutes = supportedMinutes.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );

  return {
    h: hour12.toString(),
    m: roundedMinutes.toString().padStart(2, '0'),
    p: hour24 >= 12 ? 'PM' : 'AM'
  };
};

const isTimeFilled = (h?: string, m?: string) => !!(h && m && h.length > 0 && m.length > 0);

const getDateKey = (date: Date) => date.toISOString().split('T')[0];

const formatTimeDisplay = (start: Date | null, end: Date | null): string => {
  if (start && end) return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  if (start) return `Starts at ${format(start, 'h:mm a')}`;
  if (end) return `Ends at ${format(end, 'h:mm a')}`;
  return 'Time not set';
};

const compareTimes = (a: Date, b: Date) => a.getTime() - b.getTime();

// ============================================================================
// INTERNAL SUBCOMPONENTS
// ============================================================================

const TimeRow = React.memo(({
  label,
  parts,
  onChange,
  onClear,
  error,
  small,
  touchTargets,
  styles,
  colors,
  typography,
  saveAttempted,
}: TimeRowProps) => {
  const hourValue = parts.h ? parseInt(parts.h, 10) : null;
  const minuteValue = parts.m ? parseInt(parts.m, 10) : null;

  const handleHourChange = (value: number | null) => {
    onChange({ ...parts, h: value ? value.toString() : '' });
  };

  const handleMinuteChange = (value: number | null) => {
    onChange({ ...parts, m: value !== null ? value.toString().padStart(2, '0') : '' });
  };

  return (
    <View style={styles.timeInputContainer}>
      <Text style={styles.timeFormLabel}>{label}</Text>
      <View style={styles.timeInputRow}>
        <TimeDropdown
          type="hour"
          value={hourValue}
          onChange={handleHourChange}
          label="Hour"
          small={small}
          colors={colors}
          typography={typography}
          touchTargets={touchTargets}
        />
        <Text style={styles.timeSeparator}>:</Text>
        <TimeDropdown
          type="minute"
          value={minuteValue}
          onChange={handleMinuteChange}
          label="Minute"
          small={small}
          colors={colors}
          typography={typography}
          touchTargets={touchTargets}
        />
        <View style={styles.periodToggleContainer}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              small && styles.periodButtonSmall,
              parts.p === 'AM' && styles.periodButtonActive
            ]}
            onPress={() => onChange({ ...parts, p: 'AM' })}
            accessibilityRole="button"
            accessibilityLabel="Set period to AM"
          >
            <Text style={[
              styles.periodButtonText,
              small && styles.periodButtonTextSmall,
              parts.p === 'AM' && styles.periodButtonTextActive
            ]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              small && styles.periodButtonSmall,
              parts.p === 'PM' && styles.periodButtonActive
            ]}
            onPress={() => onChange({ ...parts, p: 'PM' })}
            accessibilityRole="button"
            accessibilityLabel="Set period to PM"
          >
            <Text style={[
              styles.periodButtonText,
              small && styles.periodButtonTextSmall,
              parts.p === 'PM' && styles.periodButtonTextActive
            ]}>PM</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.timeResetButton,
            small && styles.timeResetButtonSmall,
            { marginLeft: 6 }
          ]}
          hitSlop={touchTargets.small}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()} time`}
          accessibilityHint={`Clears the ${label.toLowerCase()} time`}
          onPress={(e) => {
            e.preventDefault?.();
            onClear();
          }}
        >
          <Text style={[
            styles.clearTimeButtonText,
            small && styles.clearTimeButtonTextSmall
          ]}>✕</Text>
        </TouchableOpacity>
      </View>
      {saveAttempted && !!error ? (
        <Text style={styles.validationError}>{error}</Text>
      ) : null}
    </View>
  );
});

TimeRow.displayName = 'TimeRow';

const ValidationBanner: React.FC<{ visible: boolean; styles: any }> = ({ visible, styles }) => {
  if (!visible) return null;
  return (
    <View style={styles.validationBanner}>
      <Text style={styles.validationBannerText}>Fix highlighted times to continue</Text>
    </View>
  );
};

const EventDetailsButton: React.FC<{
  hasManualDetails: boolean;
  onPress: () => void;
  styles: any;
  colors: any;
  touchTargets: any;
  announceForAccessibility: (message: string) => void;
}> = ({ hasManualDetails, onPress, styles, colors, touchTargets, announceForAccessibility }) => (
  <View style={styles.eventDetailsSection}>
    <TouchableOpacity
      style={[styles.eventDetailsButton, hasManualDetails && styles.eventDetailsButtonActive]}
      onPress={() => {
        announceForAccessibility('Opening event details');
        onPress();
      }}
      hitSlop={touchTargets.small}
      accessibilityLabel="Edit event details"
      accessibilityHint="Opens event title, description, and location editor"
    >
      <View style={styles.eventDetailsButtonContent}>
        <View style={styles.eventDetailsButtonLeft}>
          <Text style={styles.eventDetailsButtonLabel}>Event Details</Text>
        </View>
        <View style={styles.eventDetailsButtonRight}>
          <View style={[styles.eventDetailsButtonIndicator, { opacity: hasManualDetails ? 1 : 0, marginRight: 8 }]}>
            <Text style={styles.eventDetailsButtonIndicatorText}>✓</Text>
          </View>
          <SquarePen size={20} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  </View>
);

const GlobalTimeInputs: React.FC<{
  startParts: TimeParts;
  endParts: TimeParts;
  onStartChange: (parts: TimeParts) => void;
  onEndChange: (parts: TimeParts) => void;
  onStartClear: () => void;
  onEndClear: () => void;
  errors: { globalStart: string; globalEnd: string };
  saveAttempted: boolean;
  styles: any;
  colors: any;
  typography: any;
  touchTargets: any;
}> = ({ startParts, endParts, onStartChange, onEndChange, onStartClear, onEndClear, errors, saveAttempted, styles, colors, typography, touchTargets }) => (
  <View style={styles.inputSection}>
    <Text style={styles.inputLabel}>Event Time</Text>
    <View style={styles.globalTimeInputs}>
      <TimeRow
        label="Start"
        parts={startParts}
        onChange={onStartChange}
        onClear={onStartClear}
        error={errors.globalStart}
        touchTargets={touchTargets}
        styles={styles}
        colors={colors}
        typography={typography}
        saveAttempted={saveAttempted}
      />
      <TimeRow
        label="End"
        parts={endParts}
        onChange={onEndChange}
        onClear={onEndClear}
        error={errors.globalEnd}
        touchTargets={touchTargets}
        styles={styles}
        colors={colors}
        typography={typography}
        saveAttempted={saveAttempted}
      />
    </View>
  </View>
);

const DateCard: React.FC<{
  date: Date;
  hasCustomTime: boolean;
  hasCustomLocation: boolean;
  startParts: TimeParts;
  endParts: TimeParts;
  onStartChange: (parts: TimeParts) => void;
  onEndChange: (parts: TimeParts) => void;
  onStartClear: () => void;
  onEndClear: () => void;
  onToggleCustomTime: () => void;
  onToggleCustomLocation: () => void;
  onLocationChange: (location: string) => void;
  location: string;
  displayTime: string;
  errors: { startError?: string; endError?: string };
  saveAttempted: boolean;
  styles: any;
  colors: any;
  typography: any;
  touchTargets: any;
  announceForAccessibility: (message: string) => void;
}> = ({
  date,
  hasCustomTime,
  hasCustomLocation,
  startParts,
  endParts,
  onStartChange,
  onEndChange,
  onStartClear,
  onEndClear,
  onToggleCustomTime,
  onToggleCustomLocation,
  onLocationChange,
  location,
  displayTime,
  errors,
  saveAttempted,
  styles,
  colors,
  typography,
  touchTargets,
  announceForAccessibility,
}) => (
    <View style={styles.dateCard}>
      <View style={styles.dateCardContent}>
        <View style={styles.dateCardDateContainer}>
          <Text style={styles.dateCardDate}>
            {format(date, 'MMM d, yyyy')}
          </Text>
          <Text style={styles.dateCardDayTime}>
            • {format(date, 'EEEE')}
          </Text>
        </View>
        <View style={styles.dateCardDayTimeContainer}>
          {hasCustomTime ? (
            <View style={styles.customTimeInputs}>
              <TimeRow
                label="Start"
                small
                parts={startParts}
                onChange={onStartChange}
                onClear={onStartClear}
                error={errors.startError}
                touchTargets={touchTargets}
                styles={styles}
                colors={colors}
                typography={typography}
                saveAttempted={saveAttempted}
              />
              <TimeRow
                label="End"
                small
                parts={endParts}
                onChange={onEndChange}
                onClear={onEndClear}
                error={errors.endError}
                touchTargets={touchTargets}
                styles={styles}
                colors={colors}
                typography={typography}
                saveAttempted={saveAttempted}
              />
              {saveAttempted && (errors.startError || errors.endError) && (
                <View style={styles.perDateErrorContainer}>
                  {errors.startError && (
                    <Text style={styles.validationError}>{errors.startError}</Text>
                  )}
                  {errors.endError && (
                    <Text style={styles.validationError}>{errors.endError}</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.dateCardDayTime}>{displayTime}</Text>
          )}
        </View>
        <Text style={styles.dateCardLocation}>
          📍 {hasCustomLocation ? (
            <TextInput
              style={styles.inlineLocationInput}
              value={location}
              onChangeText={onLocationChange}
              placeholder="Enter location"
              maxLength={50}
            />
          ) : location}
        </Text>

        <View style={styles.dateToggles}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Custom Time</Text>
            <Switch
              value={hasCustomTime}
              onValueChange={() => {
                onToggleCustomTime();
                announceForAccessibility(hasCustomTime ? 'Custom time disabled' : 'Custom time enabled');
              }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Custom Location</Text>
            <Switch
              value={hasCustomLocation}
              onValueChange={() => {
                onToggleCustomLocation();
                announceForAccessibility(hasCustomLocation ? 'Custom location disabled' : 'Custom location enabled');
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DateReviewModal({
  visible,
  onClose,
  onFinalize,
  selectedDates,
  eventOptions,
  defaultLocation,
  eventName,
  eventDescription,
  eventLocation,
  defaultEventName,
  onEventDetailsSave
}: DateReviewModalProps) {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { isMobile, screenWidth, screenHeight } = useDeviceType();

  useBodyScrollLock(visible);
  const styles = useMemo(() => getStyles(colors, typography, isMobile, screenWidth, screenHeight, insets), [colors, typography, isMobile, screenWidth, screenHeight, insets]);

  // ============================================================================
  // CONSOLIDATED STATE MANAGEMENT
  // ============================================================================

  const [globalTime, setGlobalTime] = useState({
    start: dateToTimeParts(eventOptions.startTime),
    end: dateToTimeParts(eventOptions.endTime),
  });

  const [errors, setErrors] = useState({
    globalStart: '',
    globalEnd: '',
    perDate: {} as Record<string, { startError?: string; endError?: string }>,
  });

  const [validationUI, setValidationUI] = useState({
    saveAttempted: false,
    showBanner: false,
  });

  const [dateSpecificOptions, setDateSpecificOptions] = useState<Record<string, DateSpecificOptions>>({});
  const [perDateTimes, setPerDateTimes] = useState<Record<string, { start: TimeParts; end: TimeParts }>>({});
  const [customTimeDates, setCustomTimeDates] = useState<Set<string>>(new Set());
  const [customLocationDates, setCustomLocationDates] = useState<Set<string>>(new Set());
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const hasManualDetails = !!(
    (eventName && eventName !== defaultEventName) ||
    eventDescription?.trim() ||
    eventLocation?.trim()
  );

  const getDateSpecificOptions = (date: Date): DateSpecificOptions => {
    const dateKey = getDateKey(date);
    return dateSpecificOptions[dateKey] || {
      location: '',
      startTime: null,
      endTime: null
    };
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const updateGlobalTime = useCallback((type: 'start' | 'end', parts: TimeParts) => {
    setGlobalTime(prev => ({ ...prev, [type]: parts }));
    setErrors(prev => ({ ...prev, [`global${type === 'start' ? 'Start' : 'End'}`]: '' }));
  }, []);

  const clearGlobalTime = useCallback((type: 'start' | 'end') => {
    setGlobalTime(prev => ({ ...prev, [type]: { h: '', m: '', p: 'AM' } }));
    setErrors(prev => ({ ...prev, [`global${type === 'start' ? 'Start' : 'End'}`]: '' }));
    announceForAccessibility(`${type === 'start' ? 'Start' : 'End'} time cleared`);
  }, [announceForAccessibility]);

  const updatePerDateTime = useCallback((date: Date, type: 'start' | 'end', parts: TimeParts) => {
    const key = getDateKey(date);
    setPerDateTimes(prev => ({
      ...prev,
      [key]: {
        start: prev[key]?.start || { h: '', m: '', p: 'AM' },
        end: prev[key]?.end || { h: '', m: '', p: 'PM' },
        [type]: parts
      }
    }));
    setErrors(prev => ({
      ...prev,
      perDate: { ...prev.perDate, [key]: { ...prev.perDate[key], [`${type}Error`]: '' } }
    }));
  }, []);

  const clearPerDateTime = useCallback((date: Date, type: 'start' | 'end') => {
    const key = getDateKey(date);
    setPerDateTimes(prev => ({
      ...prev,
      [key]: {
        start: prev[key]?.start || { h: '', m: '', p: 'AM' },
        end: prev[key]?.end || { h: '', m: '', p: 'AM' },
        [type]: { h: '', m: '', p: 'AM' }
      }
    }));
    setErrors(prev => ({
      ...prev,
      perDate: { ...prev.perDate, [key]: { ...prev.perDate[key], [`${type}Error`]: '' } }
    }));
  }, []);

  const toggleCustomTime = useCallback((date: Date) => {
    const dateKey = getDateKey(date);
    setCustomTimeDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
        setDateSpecificOptions(prev => ({
          ...prev,
          [dateKey]: { ...prev[dateKey], startTime: null, endTime: null }
        }));
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  }, []);

  const toggleCustomLocation = useCallback((date: Date) => {
    const dateKey = getDateKey(date);
    setCustomLocationDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
        setDateSpecificOptions(prev => ({
          ...prev,
          [dateKey]: { ...prev[dateKey], location: '' }
        }));
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  }, []);

  const updateDateSpecificOptions = useCallback((date: Date, updates: Partial<DateSpecificOptions>) => {
    const dateKey = getDateKey(date);
    setDateSpecificOptions(prev => ({
      ...prev,
      [dateKey]: { ...getDateSpecificOptions(date), ...updates }
    }));
  }, []);

  // ============================================================================
  // VALIDATION LOGIC
  // ============================================================================

  const validateAllTimes = useCallback(() => {
    const newErrors = { globalStart: '', globalEnd: '', perDate: {} as Record<string, { startError?: string; endError?: string }> };

    // Validate global times
    const globalStart = isTimeFilled(globalTime.start.h, globalTime.start.m)
      ? timePartsToDate(globalTime.start.h, globalTime.start.m, globalTime.start.p, new Date())
      : null;
    const globalEnd = isTimeFilled(globalTime.end.h, globalTime.end.m)
      ? timePartsToDate(globalTime.end.h, globalTime.end.m, globalTime.end.p, new Date())
      : null;

    if (isTimeFilled(globalTime.start.h, globalTime.start.m) && !globalStart) {
      newErrors.globalStart = 'Hour 1–12, Minute 00/15/30/45';
    }
    if (isTimeFilled(globalTime.end.h, globalTime.end.m) && !globalEnd) {
      newErrors.globalEnd = 'Hour 1–12, Minute 00/15/30/45';
    }
    if (globalStart && globalEnd && compareTimes(globalStart, globalEnd) > 0) {
      newErrors.globalEnd = 'End must be after Start';
    }

    // Validate per-date times
    selectedDates.forEach(date => {
      const dateKey = getDateKey(date);
      if (customTimeDates.has(dateKey)) {
        const dateTimes = perDateTimes[dateKey];
        if (dateTimes) {
          const customStart = isTimeFilled(dateTimes.start.h, dateTimes.start.m)
            ? timePartsToDate(dateTimes.start.h, dateTimes.start.m, dateTimes.start.p, date)
            : null;
          const customEnd = isTimeFilled(dateTimes.end.h, dateTimes.end.m)
            ? timePartsToDate(dateTimes.end.h, dateTimes.end.m, dateTimes.end.p, date)
            : null;

          if (isTimeFilled(dateTimes.start.h, dateTimes.start.m) && !customStart) {
            newErrors.perDate[dateKey] = { ...newErrors.perDate[dateKey], startError: 'Hour 1–12, Minute 00/15/30/45' };
          }
          if (isTimeFilled(dateTimes.end.h, dateTimes.end.m) && !customEnd) {
            newErrors.perDate[dateKey] = { ...newErrors.perDate[dateKey], endError: 'Hour 1–12, Minute 00/15/30/45' };
          }
          if (customStart && customEnd && compareTimes(customStart, customEnd) > 0) {
            newErrors.perDate[dateKey] = { ...newErrors.perDate[dateKey], endError: 'End must be after Start' };
          }
        }
      }
    });

    return newErrors;
  }, [globalTime, perDateTimes, selectedDates, customTimeDates]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  React.useEffect(() => {
    if (validationUI.saveAttempted && validationUI.showBanner) {
      const hasGlobalErrors = !!(errors.globalStart || errors.globalEnd);
      const hasPerDateErrors = Object.values(errors.perDate).some(date =>
        date?.startError || date?.endError
      );

      if (!hasGlobalErrors && !hasPerDateErrors) {
        setValidationUI(prev => ({ ...prev, showBanner: false }));
      }
    }
  }, [errors, validationUI.saveAttempted, validationUI.showBanner]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dateReviewDialog}>
          <View style={styles.dateReviewHeader}>
            <Text style={styles.dateReviewTitle}>Review Selected Dates</Text>
            <TouchableOpacity
              style={[styles.closeButton]}
              onPress={() => { onClose(); announceForAccessibility?.('Date review modal closed'); }}
              accessibilityLabel="Close"
              accessibilityHint="Closes the date review modal"
              hitSlop={touchTargets.sizeTwenty}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ValidationBanner visible={validationUI.showBanner} styles={styles} />

          <ScrollView
            style={styles.dateReviewContent}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          >
            <EventDetailsButton
              hasManualDetails={hasManualDetails}
              onPress={() => setShowEventDetailsModal(true)}
              styles={styles}
              colors={colors}
              touchTargets={touchTargets}
              announceForAccessibility={announceForAccessibility}
            />

            <GlobalTimeInputs
              startParts={globalTime.start}
              endParts={globalTime.end}
              onStartChange={(p) => updateGlobalTime('start', p)}
              onEndChange={(p) => updateGlobalTime('end', p)}
              onStartClear={() => clearGlobalTime('start')}
              onEndClear={() => clearGlobalTime('end')}
              errors={errors}
              saveAttempted={validationUI.saveAttempted}
              styles={styles}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
            />

            {selectedDates.map((date, index) => {
              const dateKey = getDateKey(date);
              const dateOptions = getDateSpecificOptions(date);
              const hasCustomTime = customTimeDates.has(dateKey);
              const hasCustomLocation = customLocationDates.has(dateKey);
              const dateTimes = perDateTimes[dateKey] || { start: { h: '', m: '', p: 'AM' as const }, end: { h: '', m: '', p: 'PM' as const } };

              const displayTime = hasCustomTime
                ? formatTimeDisplay(dateOptions.startTime, dateOptions.endTime)
                : formatTimeDisplay(
                  isTimeFilled(globalTime.start.h, globalTime.start.m)
                    ? timePartsToDate(globalTime.start.h, globalTime.start.m, globalTime.start.p, new Date())
                    : null,
                  isTimeFilled(globalTime.end.h, globalTime.end.m)
                    ? timePartsToDate(globalTime.end.h, globalTime.end.m, globalTime.end.p, new Date())
                    : null
                );

              const displayLocation = hasCustomLocation
                ? dateOptions.location
                : (defaultLocation || 'Location not set');

              return (
                <DateCard
                  key={index}
                  date={date}
                  hasCustomTime={hasCustomTime}
                  hasCustomLocation={hasCustomLocation}
                  startParts={dateTimes.start}
                  endParts={dateTimes.end}
                  onStartChange={(p) => {
                    updatePerDateTime(date, 'start', p);
                    const d = isTimeFilled(p.h, p.m) ? timePartsToDate(p.h, p.m, p.p, date) : null;
                    updateDateSpecificOptions(date, { startTime: d });
                  }}
                  onEndChange={(p) => {
                    updatePerDateTime(date, 'end', p);
                    const d = isTimeFilled(p.h, p.m) ? timePartsToDate(p.h, p.m, p.p, date) : null;
                    updateDateSpecificOptions(date, { endTime: d });
                  }}
                  onStartClear={() => {
                    clearPerDateTime(date, 'start');
                    updateDateSpecificOptions(date, { startTime: null });
                  }}
                  onEndClear={() => {
                    clearPerDateTime(date, 'end');
                    updateDateSpecificOptions(date, { endTime: null });
                  }}
                  onToggleCustomTime={() => toggleCustomTime(date)}
                  onToggleCustomLocation={() => toggleCustomLocation(date)}
                  onLocationChange={(location) => updateDateSpecificOptions(date, { location })}
                  location={displayLocation}
                  displayTime={displayTime}
                  errors={errors.perDate[dateKey] || {}}
                  saveAttempted={validationUI.saveAttempted}
                  styles={styles}
                  colors={colors}
                  typography={typography}
                  touchTargets={touchTargets}
                  announceForAccessibility={announceForAccessibility}
                />
              );
            })}
          </ScrollView>

          <View style={styles.dateReviewActions}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                announceForAccessibility('Returning to calendar');
                onClose();
              }}
              accessibilityLabel="Back to Calendar"
              accessibilityHint="Returns to the calendar view"
              hitSlop={touchTargets.small}
            >
              <Text style={styles.backButtonText}>Back to Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.finalizeButton}
              onPress={() => {
                setValidationUI(prev => ({ ...prev, saveAttempted: true }));
                const validationErrors = validateAllTimes();

                const hasErrors = validationErrors.globalStart || validationErrors.globalEnd ||
                  Object.values(validationErrors.perDate).some(date => date?.startError || date?.endError);

                if (hasErrors) {
                  setErrors(validationErrors);
                  setValidationUI(prev => ({ ...prev, showBanner: true }));
                  announceForAccessibility('Please fix the highlighted time errors');
                  return;
                }

                setValidationUI(prev => ({ ...prev, showBanner: false }));
                setErrors({ globalStart: '', globalEnd: '', perDate: {} });

                const finalOptions = {
                  location: eventOptions.location,
                  startTime: isTimeFilled(globalTime.start.h, globalTime.start.m)
                    ? timePartsToDate(globalTime.start.h, globalTime.start.m, globalTime.start.p, new Date())
                    : null,
                  endTime: isTimeFilled(globalTime.end.h, globalTime.end.m)
                    ? timePartsToDate(globalTime.end.h, globalTime.end.m, globalTime.end.p, new Date())
                    : null,
                  dateSpecificOptions: dateSpecificOptions
                };
                onFinalize(finalOptions);
                announceForAccessibility('Event creation finalized');
              }}
              accessibilityLabel="Create Event"
              accessibilityHint="Creates the event with the selected dates and options"
              hitSlop={touchTargets.small}
            >
              <Text style={styles.finalizeButtonText}>Create Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CreateEventDetails
          isVisible={showEventDetailsModal}
          onClose={() => {
            setShowEventDetailsModal(false);
            announceForAccessibility('Event details closed');
          }}
          onSave={onEventDetailsSave}
          currentEventName={eventName}
          currentDescription={eventDescription}
          currentLocation={eventLocation}
        />
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const getStyles = (colors: any, typography: any, isMobile: boolean, screenWidth: number, screenHeight: number, insets: any) => {
  const responsiveMinHeight = Math.max(500, Math.min(600, screenHeight * 0.75));

  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      paddingBottom: Math.max(20, insets.bottom),
      paddingHorizontal: 20,
    },
    dateReviewDialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      width: isMobile ? '100%' : '90%',
      maxWidth: isMobile ? 500 : Math.min(800, screenWidth * 0.8),
      minHeight: responsiveMinHeight,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    dateReviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      paddingHorizontal: 4,
    },
    eventDetailsSection: {
      marginBottom: 0,
      width: '100%',
      paddingTop: 4,
    },
    eventDetailsButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    eventDetailsButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.tints.accent,
    },
    eventDetailsButtonContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    eventDetailsButtonLeft: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    eventDetailsButtonRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    eventDetailsButtonLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      marginBottom: 2,
    },
    eventDetailsButtonIndicator: {
      backgroundColor: colors.success,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eventDetailsButtonIndicatorText: {
      fontSize: typography.fontSize.caption1,
      fontFamily: typography.getFontFamily('semibold'),
      color: '#ffffff',
    },
    dateReviewTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.headline,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    inputSection: {
      marginVertical: 8,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      marginBottom: 4,
      paddingTop: 6,
    },
    timeFormContainer: {
      flexDirection: 'column',
      marginTop: 4,
    },
    timeForm: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    globalTimeInputs: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginTop: 4,
      gap: 8,
    },
    timeInputContainer: {
      marginBottom: 8,
    },
    timeInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      maxWidth: '100%',
    },
    timeFormLabel: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      textAlign: 'left',
    },
    hhInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'solid',
      color: colors.text,
      fontSize: typography.fontSize.subheadline,
      fontFamily: typography.getFontFamily('normal'),
      backgroundColor: colors.border,
      borderRadius: 8,
      padding: 4,
      minHeight: 22,
      width: 56,
      textAlign: 'center',
    },
    timeResetButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 2,
      minHeight: 28,
      minWidth: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
      flexShrink: 1,
    },
    timeResetButtonSmall: {
      borderRadius: 6,
      padding: 3,
      minHeight: 24,
      minWidth: 28,

    },
    clearTimeButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
    },
    clearTimeButtonTextSmall: {
      fontSize: typography.fontSize.caption1,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    toggleLabel: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
    },
    dateReviewContent: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    dateCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    dateCardContent: {
      flex: 1,
    },
    dateCardDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    dateCardDate: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      marginRight: 8,
    },
    dateCardDayTime: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
    },
    dateCardDayTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    customTimeInputs: {
      flexDirection: 'column',
      alignItems: 'center',
      marginLeft: 8,
    },
    customTimeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'solid',
      color: colors.text,
      fontSize: typography.fontSize.caption2,
      fontFamily: typography.getFontFamily('normal'),
      backgroundColor: colors.background,
      borderRadius: 4,
      padding: 3,
      paddingTop: 4,
      minHeight: 20,
      width: 100,
      textAlign: 'center',
      opacity: 0.8,
      marginTop: 2,
      marginBottom: 6,
    },
    dateReviewActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    backButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      flex: 1,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
      textAlign: 'center',
    },
    finalizeButton: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.primary,
      flex: 1,
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    finalizeButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
      textAlign: 'center',
    },
    validationError: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.error,
      marginTop: 8,
      marginHorizontal: 16,
    },
    dateCardLocation: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
      marginTop: 4,
    },
    inlineLocationInput: {
      fontFamily: typography.getFontFamily('normal'),
      backgroundColor: colors.background,
      borderRadius: 6,
      padding: 6,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      marginLeft: 4,
      flex: 1,
    },
    dateToggles: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    validationBanner: {
      backgroundColor: colors.error,
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    validationBannerText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
    },
    perDateErrorContainer: {
      marginTop: 8,
      paddingHorizontal: 8,
    },
    timeSeparator: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.textMuted,
      marginHorizontal: 4,
    },
    periodToggleContainer: {
      flexDirection: 'row',
      marginLeft: 8,
    },
    periodButton: {
      paddingVertical: 8.5,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      // marginLeft: 4,
      minHeight: 28,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 1,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonSmall: {
      paddingVertical: 2.5,
      borderRadius: 6,
      minHeight: 24,
    },
    periodButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption1,
      color: colors.text,
    },
    periodButtonTextSmall: {
      fontSize: typography.fontSize.caption2,
    },
    periodButtonTextActive: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption1,
      color: colors.card,
    },
  });
};
