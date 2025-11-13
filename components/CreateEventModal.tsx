import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, Modal } from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';
import { format, isAfter, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, isSameDay, isBefore, startOfDay, min, max } from 'date-fns';
import { DateReviewModal } from './DateReviewModal';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { PollEvent } from '@/types/poll';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  pollId?: string; // Optional poll ID if creating event from a poll
}

// Interface for date-specific options that go into poll_events table
interface DateSpecificOptions {
  location: string;
  startTime: Date | null;
  endTime: Date | null;
}

// Interface for event creation options (UI state + poll_events data)
interface EventOptions {
  location: string;
  startTime: Date | null;
  endTime: Date | null;
  dateSpecificOptions?: Record<string, DateSpecificOptions>;
}

export default function CreateEventModal({ visible, onClose, onSuccess, pollId }: CreateEventModalProps) {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { isMobile, screenWidth, screenHeight } = useDeviceType();
  const router = useRouter();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(visible);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [defaultEventName, setDefaultEventName] = useState('');
  const [showDateReviewModal, setShowDateReviewModal] = useState(false);
  // Create default 1:00 PM time
  const createDefaultTime = () => {
    const defaultTime = new Date();
    defaultTime.setHours(13, 0, 0, 0); // 1:00 PM
    return defaultTime;
  };

  const [eventOptions, setEventOptions] = useState<EventOptions>({
    location: '',
    startTime: createDefaultTime(),
    endTime: createDefaultTime(),
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEventName('');
    setEventDescription('');
    setEventLocation('');
    setDefaultEventName('');
    setEventOptions({
      location: '',
      startTime: createDefaultTime(),
      endTime: createDefaultTime(),
    });
    setSelectedDates([]);
    setCurrentMonth(new Date()); // Reset calendar to current month
    setShowDateReviewModal(false);
  };

  useEffect(() => {
    if (visible) {
      announceForAccessibility?.('Create event modal opened');
    } else {
      // Reset form when modal closes
      resetForm();
    }
  }, [visible]);

  // Update default event name when selected dates change
  useEffect(() => {
    if (selectedDates.length === 0) {
      setDefaultEventName('');
      if (!eventName || eventName.startsWith('Klack: ')) {
        setEventName('');
      }
    } else if (selectedDates.length === 1) {
      const date = selectedDates[0];
      const newDefaultName = `Klack: ${format(date, 'MMM/dd')}`;
      setDefaultEventName(newDefaultName);
      if (!eventName || eventName.startsWith('Klack: ')) {
        setEventName(newDefaultName);
      }
    } else {
      const minDate = min(selectedDates);
      const maxDate = max(selectedDates);
      const newDefaultName = `Klack: ${format(minDate, 'MMM.dd')} - ${format(maxDate, 'MMM.dd')}`;
      setDefaultEventName(newDefaultName);
      if (!eventName || eventName.startsWith('Klack: ')) {
        setEventName(newDefaultName);
      }
    }
  }, [selectedDates]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev =>
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const getCalendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Adjust start to beginning of the first calendar week (Monday-start)
    let startDay = start.getDay(); // Sunday = 0
    startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Monday = 0

    // Calculate the first date to display (could be from the previous month)
    const calendarStart = new Date(start);
    calendarStart.setDate(start.getDate() - startDay);

    // Build exactly 35 days (5 weeks)
    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isPast: boolean;
    }[] = [];

    for (let i = 0; i < 35; i++) {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + i);

      days.push({
        date,
        isCurrentMonth: isSameMonth(date, currentMonth),
        isPast: isBefore(date, startOfDay(new Date())),
      });
    }

    return days;
  };

  const toggleDateSelection = (date: Date) => {
    setSelectedDates(prev => {
      const isSelected = prev.some(d => isSameDay(d, date));
      if (isSelected) {
        return prev.filter(d => !isSameDay(d, date));
      } else {
        return [...prev, date];
      }
    });
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => isSameDay(d, date));
  };


  const handleCreate = async (finalEventOptions: EventOptions) => {
    if (!eventName) {
      Alert.alert('Please enter an event name');
      return;
    }
    if (selectedDates.length === 0) {
      Alert.alert('Please select at least one available date');
      return;
    }

    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('You must be logged in to create an event');
        return;
      }

      // Create the main poll record
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          user_id: user.id,
          title: eventName,
          description: eventDescription.trim() || null,
          max_votes: 1,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Create poll_events entries for each selected date
      const eventPromises = selectedDates.map(async (date) => {
        // Get date-specific options if they exist
        const dateKey = date.toISOString().split('T')[0];
        const dateSpecificOptions = finalEventOptions.dateSpecificOptions?.[dateKey];

        // Determine location and time for this specific date
        const location = dateSpecificOptions?.location || eventLocation || '';

        const startTime = dateSpecificOptions?.startTime || finalEventOptions.startTime || null;
        const endTime = dateSpecificOptions?.endTime || finalEventOptions.endTime || null;

        const eventData = {
          poll_id: poll.id,
          location: location || '',
          event_date: format(date, 'yyyy-MM-dd'),
          start_time: startTime ? format(startTime, 'HH:mm') : null,
          end_time: endTime ? format(endTime, 'HH:mm') : null,
        };

        const { data: event, error: eventError } = await supabase
          .from('poll_events')
          .insert(eventData)
          .select()
          .single();

        if (eventError) throw eventError;
        return event;
      });

      const createdEvents = await Promise.all(eventPromises);

      Toast.show({ type: 'success', text1: 'Event created successfully!' });

      // Reset form
      resetForm();

      // Close modal and call success callback
      onClose();
      onSuccess?.();

    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => getStyles(colors, typography, insets, isMobile, screenWidth, screenHeight), [colors, typography, insets, isMobile, screenWidth, screenHeight]);

  if (!visible) return null;

  const calendarDays = getCalendarDays();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={styles.dialog}
        >
          <View style={styles.header}>
            <Text style={styles.title}>

              {/*{pollId ? 'Set for Poll' : 'Create Event'}*/}
              Select Available Dates
            </Text>
            <TouchableOpacity
              style={[styles.closeButton]}
              onPress={() => { onClose(); announceForAccessibility?.('Event creation cancelled'); }}
              accessibilityLabel="Close"
              accessibilityHint="Closes the create event modal"
              hitSlop={touchTargets.sizeTwenty}
            >
              <SFSymbolIcon name="x" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/*<Text style={styles.availabilityLabel}>Set Available Dates</Text>
            <Text style={styles.availabilitySublabel}>Tap dates when you're available to play</Text>*/}

            {/* Calendar Container */}
            <View style={styles.calendarContainer}>
              {/* Month Navigation */}
              <View style={styles.monthNavigation}>
                <TouchableOpacity
                  style={styles.monthNavButton}
                  onPress={() => { navigateMonth('prev'); announceForAccessibility?.(`Month changed to ${format(subMonths(currentMonth, 1), 'MMMM yyyy')}`); }}
                  accessibilityLabel="Previous month"
                  accessibilityHint="Navigates to the previous month"
                  hitSlop={touchTargets.small}
                >
                  <SFSymbolIcon name="chevron-left" />
                </TouchableOpacity>
                <Text style={styles.monthText} accessibilityRole="header">
                  {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <TouchableOpacity
                  style={styles.monthNavButton}
                  onPress={() => { navigateMonth('next'); announceForAccessibility?.(`Month changed to ${format(addMonths(currentMonth, 1), 'MMMM yyyy')}`); }}
                  accessibilityLabel="Next month"
                  accessibilityHint="Navigates to the next month"
                  hitSlop={touchTargets.small}
                >
                  <SFSymbolIcon name="chevron-right" />
                </TouchableOpacity>
              </View>

              {/* Day Headers */}
              <View style={styles.dayHeaders}>
                {days.map((day, index) => (
                  <Text
                    key={day}
                    style={[
                      styles.dayHeader,
                      index === days.length - 1 && styles.lastDayHeader // Remove border from last header
                    ]}
                  >
                    {day}
                  </Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {Array.from({ length: 5 }, (_, rowIndex) => (
                  <View key={rowIndex} style={styles.calendarRow}>
                    {Array.from({ length: 7 }, (_, colIndex) => {
                      const dayIndex = rowIndex * 7 + colIndex;
                      const dayData = calendarDays[dayIndex];
                      if (!dayData) return (
                        <TouchableOpacity
                          key={colIndex}
                          style={styles.calendarDay}
                          disabled={true}
                        />
                      );

                      const { date, isCurrentMonth, isPast } = dayData;
                      const isSelected = isDateSelected(date);

                      return (
                        <TouchableOpacity
                          key={colIndex}
                          style={[
                            styles.calendarDay,
                            isSelected && styles.selectedDay,
                            !isCurrentMonth && styles.otherMonthDay,
                            isPast && styles.pastDay,
                          ]}
                          onPress={() => { if (!isPast) { toggleDateSelection(date); announceForAccessibility?.(`${format(date, 'MMM d')} ${isSelected ? 'deselected' : 'selected'}`); } }}
                          disabled={isPast}
                          accessibilityRole="button"
                          accessibilityLabel={`${format(date, 'EEEE, MMMM d')}${isPast ? ', unavailable' : ''}`}
                          accessibilityHint={isPast ? undefined : 'Toggles date selection'}
                          hitSlop={touchTargets.small}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              isSelected && styles.selectedDayText,
                              !isCurrentMonth && styles.otherMonthDayText,
                              isPast && styles.pastDayText,
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.createButton, selectedDates.length === 0 && styles.createButtonDisabled]}
              onPress={() => { if (selectedDates.length > 0) { setShowDateReviewModal(true); announceForAccessibility?.('Review selected dates'); } }}
              disabled={selectedDates.length === 0}
              accessibilityLabel="Review selected dates"
              accessibilityHint="Opens the review screen to finalize event details"
              hitSlop={touchTargets.small}
            >
              <Text style={styles.createButtonText}>Select Dates</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onClose(); announceForAccessibility?.('Event creation cancelled'); }} style={styles.cancelButton} accessibilityLabel="Cancel" accessibilityHint="Closes the create event modal" hitSlop={touchTargets.small}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Review Modal */}
        <DateReviewModal
          visible={showDateReviewModal}
          onClose={() => setShowDateReviewModal(false)}
          onFinalize={handleCreate}
          selectedDates={selectedDates}
          eventOptions={eventOptions}
          defaultLocation={eventLocation}
          pollId={pollId}
          eventName={eventName}
          eventDescription={eventDescription}
          eventLocation={eventLocation}
          defaultEventName={defaultEventName}
          onEventDetailsSave={(name, description, location) => {
            setEventName(name);
            setEventDescription(description);
            setEventLocation(location);
          }}
        />
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, typography: any, insets: any, isMobile: boolean, screenWidth: number, screenHeight: number) => {
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
      paddingTop: Math.max(16, insets.top),
      paddingBottom: Math.max(16, insets.bottom),
      paddingHorizontal: 16,
    },
    dialogContainer: {
      maxWidth: 300,
      maxHeight: '95%',
      width: '100%',
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      width: isMobile ? '100%' : '90%',
      maxWidth: isMobile ? 500 : Math.min(800, screenWidth * 0.8),
      minHeight: responsiveMinHeight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.headline,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      paddingHorizontal: 4,
    },
    content: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    footer: {
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
      backgroundColor: colors.card,
    },
    createButton: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center'
    },
    createButtonDisabled: {
      backgroundColor: colors.border,
    },
    cancelButton: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 12,
    },


    availabilityLabel: {
      marginTop: 16,
      marginBottom: 4,
      fontSize: typography.fontSize.callout,
      color: colors.text,
      fontFamily: typography.getFontFamily('semibold'),
    },
    availabilitySublabel: {
      marginBottom: 8,
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
      fontFamily: typography.getFontFamily('normal'),
    },
    createButtonText: {
      color: '#ffffff',
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
    },
    cancelButtonText: {
      color: colors.accent,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
    },
    calendarContainer: {
      padding: 10,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
      maxWidth: 350, // Fixed maximum width
      alignSelf: 'center',
      overflow: 'hidden', // Prevent overflow
    },
    monthNavigation: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    monthNavButton: {
      padding: 5,
    },
    monthText: {
      fontSize: typography.fontSize.headline,
      color: colors.text,
      fontFamily: typography.getFontFamily('semibold'),
    },
    dayHeaders: {
      flexDirection: 'row',
      marginBottom: 5,
      width: '100%',
    },
    dayHeader: {
      flex: 1, // Equal width for each header
      height: 30, // Reduced height for headers
      textAlign: 'center',
      lineHeight: 30,
      backgroundColor: colors.border,
      fontSize: typography.fontSize.caption1,
      color: colors.text,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    dayHeaderText: {
      fontSize: typography.fontSize.caption1,
      color: colors.text,
    },
    lastDayHeader: {
      borderRightWidth: 0, // Remove border from last header
    },
    calendarGrid: {
      width: '100%', // Use full width of container
      height: 220, // Fixed height for 5 rows (44 * 5 = 220)
    },
    calendarRow: {
      flexDirection: 'row',
      width: '100%',
      height: 44, // Fixed height per row (220 ÷ 5 = 44)
    },
    calendarDay: {
      flex: 1, // Equal width for each day cell
      height: 44, // Match row height
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    otherMonthDay: {
      opacity: 0.5,
    },
    pastDay: {
      backgroundColor: colors.background,
      borderColor: colors.background,
    },
    selectedDay: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    dayText: {
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
    },
    otherMonthDayText: {
      color: colors.textMuted,
    },
    pastDayText: {
      color: colors.textMuted,
    },
    selectedDayText: {
      color: '#ffffff',
    },
  });
};
