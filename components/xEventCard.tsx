import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { format } from 'date-fns';
import { TruncatedText } from './TruncatedText';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    start_time?: string | null;
    end_time?: string | null;
    created_at: string;
  };
  eventDates: Array<{
    id: string;
    date: string;
    location?: string;
    start_time?: string | null;
    end_time?: string | null;
  }>;
  rsvpCount: number;
  isCreator: boolean;
  onShare: (eventId: string) => void;
  onEdit: (event: any) => void;
  onDelete: (event: any) => void;
  isMobile: boolean;
  isSmallMobile: boolean;
}

export function EventCard({
  event,
  eventDates,
  rsvpCount,
  isCreator,
  onShare,
  onEdit,
  onDelete,
  isMobile,
  isSmallMobile,
}: EventCardProps) {
  const getDisplayLocation = () => {
    if (event.location) return event.location;
    if (eventDates.length > 0 && eventDates[0].location) return eventDates[0].location;
    return 'Location not set';
  };
  
  const getDisplayTime = () => {
    const _ = (startTime: string | null, endTime: string | null): string => {
      if (startTime && endTime) {
        return ` ${startTime} - ${endTime}`;
      } else if (startTime) {
        return ` Starts at ${startTime}`;
      } else if (endTime) {
        return ` Ends at ${endTime}`;
      } else {
        return ' Time not set';
      }
    };
    console.log('event.start_time:', event.start_time);
    console.log('event.end_time:', event.end_time);
    console.log('eventDates[0].start_time:', eventDates[0].start_time);
    console.log('eventDates[0].end_time:', eventDates[0].end_time);
    if (event.start_time || event.end_time) {
      return _(event.start_time, event.end_time);
    }
    //if (eventDates.length > 0 && (eventDates[0].start_time || eventDates[0].end_time)) {
    else {
      return _(eventDates[0].start_time, eventDates[0].end_time);
    }
  };

  const getDateRange = () => {
    if (eventDates.length === 0) return 'No dates set';
    if (eventDates.length === 1) {
      return format(new Date(eventDates[0].date), 'MMM d, yyyy');
    }

    const sortedDates = [...eventDates].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstDate = format(new Date(sortedDates[0].date), 'MMM d');
    const lastDate = format(new Date(sortedDates[sortedDates.length - 1].date), 'MMM d, yyyy');

    return `${firstDate} - ${lastDate}`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {event.description && (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <SFSymbolIcon name="calendar" color="#666666" />
          <Text style={styles.detailText}>{getDateRange()}</Text>
        </View>

        <View style={styles.detailRow}>
          <SFSymbolIcon name="mappin" color="#666666" />
          <TruncatedText
            text={getDisplayLocation()}
            maxLength={35}
            textStyle={styles.detailText}
            buttonTextStyle={styles.truncateButtonText}
          />
        </View>

        <View style={styles.detailRow}>
          <SFSymbolIcon name="clock" color="#666666" />
          <Text style={styles.detailText}>{getDisplayTime()}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.rsvpCount}>
          <Text style={styles.rsvpCountText}>{rsvpCount} RSVPs</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onShare(event.id)}
          >
            <SFSymbolIcon name="share2" color="#ff9654" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>

          {isCreator && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onEdit(event)}
              >
                <SFSymbolIcon name="edit" color="#4b5563" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDelete(event)}
              >
                <SFSymbolIcon name="trash2" color="#e74c3c" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  description: {
    fontSize: 14,
    color: '#666666',
    marginTop: 5,
  },
  details: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rsvpCount: {
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rsvpCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 5,
  },
  truncateButtonText: {
    color: '#0070f3',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
