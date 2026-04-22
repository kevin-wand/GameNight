import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform, TextInput } from 'react-native';
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from '@/components/xwheel-picker';
import { format } from 'date-fns';
import { useRegisterModalSurface } from '@/contexts/ModalSurfaceContext';

interface TimeSelection {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

interface ScrollableTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (time: Date) => void;
  initialTime?: Date | null;
  title: string;
  validationError?: string;
}

export function ScrollableTimePicker({
  visible,
  onClose,
  onSave,
  initialTime,
  title,
  validationError
}: ScrollableTimePickerProps) {
  useRegisterModalSurface('ScrollableTimePicker', visible);
  const [selectedHour, setSelectedHour] = useState(6);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  // const [manualHourInput, setManualHourInput] = useState('');
  // const [manualMinuteInput, setManualMinuteInput] = useState('');
  // const [manualPeriodInput, setManualPeriodInput] = useState<'AM' | 'PM'>('PM');
  // const [showManualInput, setShowManualInput] = useState(false);
  // const [lastValidTime, setLastValidTime] = useState<{ hour: number, minute: number, period: 'AM' | 'PM' } | null>(null);
  // const [isManualInputFocused, setIsManualInputFocused] = useState(false);
  // const minuteInputRef = useRef<TextInput | null>(null);

  // const hourScrollRef = useRef<ScrollView | null>(null);
  // const minuteScrollRef = useRef<ScrollView | null>(null);

  // Generate time options
  const hours: WheelPickerOption[] = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: (i + 1).toString() }));
  const minutes: WheelPickerOption[] = ([0, 15, 30, 45]).map(_ => ({ value: _, label: _.toString().padStart(2, '0') }));
  const periods: WheelPickerOption[] = [
    { value: 'AM', label: 'AM' },
    { value: 'PM', label: 'PM' },
  ];

  // Initialize time picker every time modal opens
  useEffect(() => {
    if (visible) {
      // Use initialTime if provided, otherwise default to 6:00 PM
      const now = initialTime ?? new Date();
      let displayHour, displayMinute, period;

      if (initialTime) {
        // If initialTime is provided, use it
        const hour = now.getHours();
        const minute = now.getMinutes();
        displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        displayMinute = Math.floor(minute / 15) * 15;
        period = hour >= 12 ? 'PM' : 'AM';
      } else {
        // Default to 6:00 PM
        displayHour = 6;
        displayMinute = 0;
        period = 'PM';
      }

      setSelectedHour(displayHour);
      setSelectedMinute(displayMinute);
      setSelectedPeriod(period as 'AM' | 'PM');

      // Initialize manual input values to match the initial time
      // setManualHourInput(displayHour.toString());
      // setManualMinuteInput(displayMinute.toString().padStart(2, '0'));
      // setManualPeriodInput(period as 'AM' | 'PM');

      // Initialize scroll wheels
      /* const hourIndex = hours.indexOf(displayHour);
      const minuteIndex = minutes.indexOf(displayMinute);

      // Use requestAnimationFrame to ensure the scroll views are ready
      requestAnimationFrame(() => {
        if (hourScrollRef.current && hourIndex >= 0) {
          hourScrollRef.current.scrollTo({ y: hourIndex * 60, animated: false });
        }
        if (minuteScrollRef.current && minuteIndex >= 0) {
          minuteScrollRef.current.scrollTo({ y: minuteIndex * 60, animated: false });
        }
      });

      // Fallback: try again after a short delay in case the first attempt fails
      setTimeout(() => {
        if (hourScrollRef.current && hourIndex >= 0) {
          hourScrollRef.current.scrollTo({ y: hourIndex * 60, animated: false });
        }
        if (minuteScrollRef.current && minuteIndex >= 0) {
          minuteScrollRef.current.scrollTo({ y: minuteIndex * 60, animated: false });
        }
      }, 200); */
    }
  }, [visible, initialTime]);

  // Update lastValidTime when scroll wheel values change
  /* useEffect(() => {
    if (!isManualInputFocused) {
      setLastValidTime({
        hour: selectedHour,
        minute: selectedMinute,
        period: selectedPeriod
      });
    }
  }, [selectedHour, selectedMinute, selectedPeriod, isManualInputFocused]); */

  // Update showManualInput based on focus state
  /* useEffect(() => {
    setShowManualInput(isManualInputFocused);
  }, [isManualInputFocused]); */

  // Sync scroll wheels when selected values change
  /* useEffect(() => {
    const hourIndex = hours.indexOf(selectedHour);
    const minuteIndex = minutes.indexOf(selectedMinute);

    if (hourScrollRef.current && hourIndex >= 0) {
      hourScrollRef.current.scrollTo({ y: hourIndex * 60, animated: true });
    }
    if (minuteScrollRef.current && minuteIndex >= 0) {
      minuteScrollRef.current.scrollTo({ y: minuteIndex * 60, animated: true });
    }
  }, [selectedHour, selectedMinute]); */

  const createTimeFromSelection = (): Date => {
    const now = new Date();

    // Use manual input values if manual input is focused, otherwise use scroll wheel values
    let hour;

    /* if (isManualInputFocused) {
      const manualHour = parseInt(manualHourInput, 10);
      const manualMinute = parseInt(manualMinuteInput, 10);

      hour = (!isNaN(manualHour) && manualHour >= 1 && manualHour <= 12) ? manualHour : selectedHour;
      minute = (!isNaN(manualMinute) && manualMinute >= 0 && manualMinute <= 59)
        ? Math.floor(manualMinute / 15) * 15
        : selectedMinute;
      period = manualPeriodInput;
    } else {
      hour = selectedHour;
      minute = selectedMinute;
      period = selectedPeriod;
    } */

    // Convert to 24-hour format
    if (selectedPeriod === 'PM' && selectedHour !== 12) {
      hour = selectedHour + 12;
    } else if (selectedPeriod === 'AM' && selectedHour === 12) {
      hour = 0;
    } else {
      hour = selectedHour;
    }

    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, selectedMinute);
  };

  const handleSave = () => {
    // createTimeFromSelection() already handles manual input values
    const newTime = createTimeFromSelection();
    onSave(newTime);
  };

  const formatTime = (): string => {
    // If manual input is focused, show the current manual input values
    /* if (isManualInputFocused) {
      // Always show what's in the manual input fields, even if empty
      const displayHour = manualHourInput || '';
      const displayMinute = manualMinuteInput || '';
      const period = manualPeriodInput;

      // Format the display with proper padding for minutes
      const formattedMinute = displayMinute ? displayMinute.padStart(2, '0') : '';
      return `${displayHour}:${formattedMinute} ${period}`;
    } */
    return `${selectedHour}:${selectedMinute.toString().padStart(2, '0')} ${selectedPeriod}`;
  };

  /* const validateAndSetManualTime = (newHourInput?: string, newMinuteInput?: string) => {
    const hourText = newHourInput ?? manualHourInput;
    const minuteText = newMinuteInput ?? manualMinuteInput;
    const hour = parseInt(hourText, 10);
    const minute = parseInt(minuteText, 10);


    let shouldUpdate = false;
    let clampedHour = selectedHour;
    let clampedMinute = selectedMinute;

    // Only update if we have valid input
    // Update hour if valid (1-12) and not empty
    if (hourText !== '' && !isNaN(hour) && hour >= 1 && hour <= 12) {
      clampedHour = Math.max(1, Math.min(12, hour));
      shouldUpdate = true;
    }

    // Update minute if valid (0-59) and not empty
    if (minuteText !== '' && !isNaN(minute) && minute >= 0 && minute <= 59) {
      clampedMinute = Math.floor(minute / 15) * 15; // Round to nearest 15
      shouldUpdate = true;
    }

    // Update period if it changed
    if (manualPeriodInput !== selectedPeriod) {
      shouldUpdate = true;
    }


    if (shouldUpdate) {
      // Update the selected values immediately
      setSelectedHour(clampedHour);
      setSelectedMinute(clampedMinute);
      setSelectedPeriod(manualPeriodInput);

      // Store the last valid time
       setLastValidTime({
        hour: clampedHour,
        minute: clampedMinute,
        period: manualPeriodInput
      });
    } else {
      // If no valid input, maintain current scroll wheel position
      // Don't let them revert to default values
      const hourIndex = hours.indexOf(selectedHour);
      const minuteIndex = minutes.indexOf(selectedMinute);

      if (hourScrollRef.current && hourIndex >= 0) {
        hourScrollRef.current.scrollTo({ y: hourIndex * 60, animated: false });
      }
      if (minuteScrollRef.current && minuteIndex >= 0) {
        minuteScrollRef.current.scrollTo({ y: minuteIndex * 60, animated: false });
      }
    }
  }; */

  /* const handleManualInputBlur = () => {
    // Apply the manual input values to the selected values before exiting
    const hour = parseInt(manualHourInput, 10);
    const minute = parseInt(manualMinuteInput, 10);

    if (!isNaN(hour) && hour >= 1 && hour <= 12) {
      setSelectedHour(hour);
    }
    if (!isNaN(minute) && minute >= 0 && minute <= 59) {
      setSelectedMinute(Math.floor(minute / 15) * 15);
    }
    setSelectedPeriod(manualPeriodInput);

    setIsManualInputFocused(false);
  }; */

  /* const handleManualInputSubmit = () => {
    // Apply the manual input values to the selected values before exiting
    const hour = parseInt(manualHourInput, 10);
    const minute = parseInt(manualMinuteInput, 10);

    if (!isNaN(hour) && hour >= 1 && hour <= 12) {
      setSelectedHour(hour);
    }
    if (!isNaN(minute) && minute >= 0 && minute <= 59) {
      setSelectedMinute(Math.floor(minute / 15) * 15);
    }
    setSelectedPeriod(manualPeriodInput);

    setIsManualInputFocused(false);
  }; */

  /*   const toggleManualInput = () => {
      if (!isManualInputFocused) {
        // Switching to manual input mode
        setManualHourInput(selectedHour.toString());
        setManualMinuteInput(selectedMinute.toString().padStart(2, '0'));
        setManualPeriodInput(selectedPeriod);
        setLastValidTime({
          hour: selectedHour,
          minute: selectedMinute,
          period: selectedPeriod
        });
        setIsManualInputFocused(true);
      } else {
        // Switching to scroll wheel mode
        setIsManualInputFocused(false);
      }
    }; */

  /* const TimePickerColumn = ({
    items,
    selectedValue,
    onValueChange,
    scrollRef,
    formatter
  }: {
    items: number[];
    selectedValue: number;
    onValueChange: (value: number) => void;
    scrollRef: React.RefObject<ScrollView | null>;
    formatter?: (value: number) => string;
  }) => {
    const handleScroll = (event: any) => {
      const scrollY = event.nativeEvent.contentOffset.y;
      const index = Math.round(scrollY / 60);
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      const targetY = clampedIndex * 60;

      // Force snap to exact position during scrolling (moderately aggressive)
      if (Math.abs(scrollY - targetY) > 6) {
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
      }
    };

    const handleScrollEnd = (event: any) => {

      const scrollY = event.nativeEvent.contentOffset.y;
      const index = Math.round(scrollY / 60);

      // Clamp index to valid range
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

      if (clampedIndex >= 0 && clampedIndex < items.length) {
        // Force scroll to exact position with smooth animation
        const targetY = clampedIndex * 60;
        scrollRef.current?.scrollTo({ y: targetY, animated: true });

        onValueChange(items[clampedIndex]);
        // Switch focus to scroll wheel mode when user scrolls
         setIsManualInputFocused(false);
        // Sync manual input when scroll wheel changes
        if (items === hours) {
          setManualHourInput(items[clampedIndex].toString());
        } else if (items === minutes) {
          setManualMinuteInput(items[clampedIndex].toString().padStart(2, '0'));
        } 
      }
    };

    const handleTimeOptionPress = (item: number) => {
      onValueChange(item);
      // Switch focus to scroll wheel mode when user taps
      setIsManualInputFocused(false);
      // Sync manual input when scroll wheel changes
      if (items === hours) {
        setManualHourInput(item.toString());
      } else if (items === minutes) {
        setManualMinuteInput(item.toString().padStart(2, '0'));
      }
    };

    return (
      <View style={styles.timeColumn}>
        <ScrollView
          ref={scrollRef}
          style={styles.timeScrollView}
          showsVerticalScrollIndicator={false}
          snapToInterval={60}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
        >
          <View style={styles.scrollPadding} />

          {items.map((item, index) => (
            <TouchableOpacity
              key={item}
              style={styles.timeOption}
              onPress={() => handleTimeOptionPress(item)}
            >
              <Text style={[
                styles.timeOptionText,
                item === selectedValue && styles.timeOptionTextSelected
              ]}>
                {formatter ? formatter(item) : item}
              </Text>
            </TouchableOpacity>
          ))}
          
          <View style={styles.scrollPadding} />
        </ScrollView>
        
        <View style={styles.selectionIndicator} />
      </View>
    );
  }; */

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Time Display */}
          {/* <View style={styles.timeDisplay}>
            {showManualInput ? (
              <View style={styles.manualInputContainer}>
                <View style={styles.manualInputFields}>
                  <TextInput
                    style={styles.manualTimeInput}
                    value={manualHourInput}
                    onChangeText={(text) => {
                      setManualHourInput(text);
                      // Update time immediately as user types
                      validateAndSetManualTime(text, manualMinuteInput);
                    }}
                    onFocus={() => setIsManualInputFocused(true)}
                    onBlur={handleManualInputBlur}
                    onSubmitEditing={() => {
                      // Move focus to minutes field
                      minuteInputRef.current?.focus();
                    }}
                    placeholder="6"
                    placeholderTextColor="#999999"
                    keyboardType="numeric"
                    maxLength={2}
                    returnKeyType="next"
                  />
                  <Text style={styles.timeSeparator}>:</Text>
                  <TextInput
                    ref={minuteInputRef}
                    style={styles.manualTimeInput}
                    value={manualMinuteInput}
                    onChangeText={(text) => {
                      setManualMinuteInput(text);
                      // Update time immediately as user types
                      validateAndSetManualTime(manualHourInput, text);
                    }}
                    onFocus={() => setIsManualInputFocused(true)}
                    onBlur={handleManualInputBlur}
                    onSubmitEditing={() => {
                      validateAndSetManualTime();
                      setIsManualInputFocused(false);
                    }}
                    placeholder="30"
                    placeholderTextColor="#999999"
                    keyboardType="numeric"
                    maxLength={2}
                    returnKeyType="done"
                  />
                </View>
                <View style={styles.manualPeriodContainer}>
                  <TouchableOpacity
                    style={[
                      styles.manualPeriodButton,
                      manualPeriodInput === 'AM' && styles.manualPeriodButtonSelected
                    ]}
                    onPress={() => {
                      setManualPeriodInput('AM');
                      setSelectedPeriod('AM');
                      // Sync manual input with scroll wheel values when not focused
                      if (!isManualInputFocused) {
                        setManualHourInput(selectedHour.toString());
                        setManualMinuteInput(selectedMinute.toString().padStart(2, '0'));
                      }
                    }}
                  >
                    <Text style={[
                      styles.manualPeriodButtonText,
                      manualPeriodInput === 'AM' && styles.manualPeriodButtonTextSelected
                    ]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.manualPeriodButton,
                      manualPeriodInput === 'PM' && styles.manualPeriodButtonSelected
                    ]}
                    onPress={() => {
                      setManualPeriodInput('PM');
                      setSelectedPeriod('PM');
                      // Sync manual input with scroll wheel values when not focused
                      if (!isManualInputFocused) {
                        setManualHourInput(selectedHour.toString());
                        setManualMinuteInput(selectedMinute.toString().padStart(2, '0'));
                      }
                    }}
                  >
                    <Text style={[
                      styles.manualPeriodButtonText,
                      manualPeriodInput === 'PM' && styles.manualPeriodButtonTextSelected
                    ]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={toggleManualInput}>
                <Text style={styles.timeDisplayText}>{formatTime()}</Text>
              </TouchableOpacity>
            )}
          </View> */}

          <WheelPickerWrapper className={/*"time-wheel-picker-wrapper"*/null}>
            <WheelPicker
              options={hours}
              value={selectedHour}
              onValueChange={setSelectedHour}
              infinite
              classNames={/*{
                optionItem: 'time-wheel-picker-hour-min-option',
                highlightItem: 'time-wheel-picker-hour-min-highlight',
                highlightWrapper: 'time-wheel-picker-hour-min-highlight-wrapper',
              }*/
                //null
                {
                  optionItem: 'time-wheel-picker-am-pm-option',
                  highlightItem: 'time-wheel-picker-am-pm-highlight',
                }
              }
            />
            <WheelPicker
              options={minutes}
              value={selectedMinute}
              onValueChange={setSelectedMinute}
              classNames={/*{
                optionItem: 'time-wheel-picker-hour-min-option',
                highlightItem: 'time-wheel-picker-hour-min-highlight',
                highlightWrapper: 'time-wheel-picker-hour-min-highlight-wrapper',
              }*/
                //null
                {
                  optionItem: 'time-wheel-picker-am-pm-option',
                  highlightItem: 'time-wheel-picker-am-pm-highlight',
                }
              }
            />
            <WheelPicker
              options={periods}
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              classNames={{
                optionItem: 'time-wheel-picker-am-pm-option',
                highlightItem: 'time-wheel-picker-am-pm-highlight',
              }}
            />
          </WheelPickerWrapper>

          <label htmlFor="native-time">Sample time input:</label>
          <input id="native-time" type="time" defaultValue="18:00" />

          {/* Time Picker */}
          {/* <View style={styles.timePickerContainer}>
            <TimePickerColumn
              items={hours}
              selectedValue={selectedHour}
              onValueChange={setSelectedHour}
              scrollRef={hourScrollRef}
            />
            <Text style={styles.separator}>:</Text>
            <TimePickerColumn
              items={minutes}
              selectedValue={selectedMinute}
              onValueChange={setSelectedMinute}
              scrollRef={minuteScrollRef}
              formatter={(minute) => minute.toString().padStart(2, '0')}
            />
            <View style={styles.periodContainer}>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  selectedPeriod === 'AM' && styles.periodButtonSelected
                ]}
                onPress={() => {
                  setSelectedPeriod('AM');
                  // Switch focus to scroll wheel mode when user taps period
                  // setIsManualInputFocused(false);
                  // Sync manual input when scroll wheel period changes
                  // setManualPeriodInput('AM');
                }}
              >
                <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === 'AM' && styles.periodButtonTextSelected
                ]}>
                  AM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  selectedPeriod === 'PM' && styles.periodButtonSelected
                ]}
                onPress={() => {
                  setSelectedPeriod('PM');
                  // Switch focus to scroll wheel mode when user taps period
                  // setIsManualInputFocused(false);
                  // Sync manual input when scroll wheel period changes
                  // setManualPeriodInput('PM');
                }}
              >
                <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === 'PM' && styles.periodButtonTextSelected
                ]}>
                  PM
                </Text>
              </TouchableOpacity>
            </View>
          </View> */}

          {/* Validation Error */}
          {validationError ? (
            <Text style={styles.validationError}>{validationError}</Text>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: Platform.OS === 'web' ? 20 : 10,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 350,
    height: '80%',
    maxHeight: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5ea',
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1a2b5f',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5ea',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Poppins-SemiBold',
  },
  timeDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5ea',
  },
  timeDisplayText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 32,
    color: '#1a2b5f',
    letterSpacing: 1,
  },
  manualInputContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  manualPeriodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  manualPeriodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e1e5ea',
    minWidth: 60,
    alignItems: 'center',
  },
  manualPeriodButtonSelected: {
    backgroundColor: '#0070f3',
    borderColor: '#0070f3',
  },
  manualPeriodButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#666666',
  },
  manualPeriodButtonTextSelected: {
    color: 'white',
  },
  manualInputFields: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualTimeInput: {
    fontFamily: 'Poppins-Regular',
    fontSize: 28,
    color: '#1a2b5f',
    borderWidth: 2,
    borderColor: '#0070f3',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 60,
    textAlign: 'center',
  },
  timeSeparator: {
    fontFamily: 'Poppins-Regular',
    fontSize: 28,
    color: '#1a2b5f',
    marginHorizontal: 4,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flex: 1,
  },
  timeColumn: {
    flex: 1,
    maxWidth: 80,
    height: 180,
    position: 'relative',
  },
  timeScrollView: {
    flex: 1,
  },
  scrollPadding: {
    height: 60,
  },
  timeOption: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeOptionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 24,
    color: '#666666',
  },
  timeOptionTextSelected: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 28,
    color: '#0070f3',
  },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 60,
    marginTop: -30,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#0070f3',
    backgroundColor: 'rgba(0, 112, 243, 0.1)',
    pointerEvents: 'none',
  },
  separator: {
    fontFamily: 'Poppins-Regular',
    fontSize: 28,
    color: '#666666',
    marginHorizontal: 10,
  },
  periodContainer: {
    marginLeft: 20,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e1e5ea',
    minWidth: 60,
    alignItems: 'center',
  },
  periodButtonSelected: {
    backgroundColor: '#0070f3',
    borderColor: '#0070f3',
  },
  periodButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#666666',
  },
  periodButtonTextSelected: {
    color: 'white',
  },
  validationError: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e1e5ea',
    gap: 12,
    flexShrink: 0, // Prevent buttons from shrinking
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5ea',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#666666',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0070f3',
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: 'white',
  },
});
