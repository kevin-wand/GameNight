import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;

// ============================================================================
// TIME OPTIONS
// ============================================================================

export const hourOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1)
}));

export const minuteOptions = [
  { value: 0, label: '00' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 45, label: '45' }
];

// ============================================================================
// COMPONENT
// ============================================================================

interface TimeDropdownProps {
  type: 'hour' | 'minute';
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  small?: boolean;
  colors: any;
  typography: any;
  touchTargets: any;
}

export const TimeDropdown: React.FC<TimeDropdownProps> = ({
  type,
  value,
  onChange,
  label,
  small = false,
  colors,
  typography,
  touchTargets
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);

  const options = type === 'hour' ? hourOptions : minuteOptions;
  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : (type === 'hour' ? 'HH' : 'MM');

  const buttonStyle = small ? {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 24,
    backgroundColor: colors.background,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: 50,
    flexShrink: 1,
  } : {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 28,
    backgroundColor: colors.card,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: 62,
    flexShrink: 1,
  };

  return (
    <View>
      <TouchableOpacity
        style={buttonStyle}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={`${label}: ${displayText}`}
        accessibilityRole="button"
        hitSlop={touchTargets.small}
      >
        <Text
          style={{
            fontFamily: typography.getFontFamily('normal'),
            fontSize: small ? typography.fontSize.caption2 : typography.fontSize.subheadline,
            color: value != null ? colors.text : colors.textMuted,
            textAlign: 'center',
            flex: 1,
          }}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Text style={{
          fontSize: small ? 8 : 10,
          color: colors.textMuted,
          marginLeft: 4,
          fontWeight: 'bold'
        }}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        presentationStyle="overFullScreen"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.tints.neutral,
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              maxHeight: '80%',
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.getFontFamily('semibold'),
                  fontSize: typography.fontSize.callout,
                  color: colors.text,
                }}
              >
                {label}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={touchTargets.small}
              >
                <SFSymbolIcon name="x" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item: { value: number; label: string }) => item.value.toString()}
              renderItem={({ item }: { item: { value: number; label: string } }) => {
                const isSelected = item.value === value;
                const isHovered = hoveredOption === item.value;
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      minHeight: 44,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                    onPress={() => {
                      onChange(item.value);
                      setModalVisible(false);
                    }}
                    onPressIn={() => setHoveredOption(item.value)}
                    onPressOut={() => setHoveredOption(null)}
                    accessibilityLabel={item.label}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    activeOpacity={0.6}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        marginRight: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderColor: isSelected ? colors.accent : (isHovered ? colors.accent : colors.textMuted),
                        backgroundColor: isSelected ? colors.accent : (isHovered ? colors.accent : 'transparent'),
                      }}
                    >
                      {isSelected && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.card,
                          }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: typography.getFontFamily(isSelected ? 'semibold' : 'normal'),
                        fontSize: typography.fontSize.subheadline,
                        color: isSelected ? colors.accent : colors.text,
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  onChange(null);
                  setModalVisible(false);
                }}
                hitSlop={touchTargets.small}
              >
                <Text
                  style={{
                    fontFamily: typography.getFontFamily('normal'),
                    fontSize: typography.fontSize.subheadline,
                    color: colors.textMuted,
                  }}
                >
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={touchTargets.small}
              >
                <Text
                  style={{
                    fontFamily: typography.getFontFamily('semibold'),
                    fontSize: typography.fontSize.subheadline,
                    color: colors.accent,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

