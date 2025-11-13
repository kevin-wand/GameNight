import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback, FlatList } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { Game } from '@/types/game';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';
import { FilterState, NumericRange, FilterOption, playerOptions, minTimeOptions, maxTimeOptions, ageOptions, typeOptions, complexityOptions } from '@/utils/filterOptions';

interface FilterGameModalProps {
  isVisible: boolean;
  onClose: () => void;
  onApplyFilters: () => void;
  title?: string;
  description?: string;
  applyButtonText?: string;
  initialFilters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

// Reusable Dropdown Component with Modal
interface FilterDropdownProps {
  placeholder: string;
  value: number | null | undefined;
  options: FilterOption[];
  onChange: (value: number | null) => void;
  colors: any;
  typography: any;
  touchTargets: any;
  label: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  placeholder,
  value,
  options,
  onChange,
  colors,
  typography,
  touchTargets,
  label,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: 44,
          backgroundColor: colors.card,
          borderColor: value != null ? colors.accent : colors.border,
        }}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={`${placeholder}: ${displayText}`}
        accessibilityRole="button"
      >
        <Text
          style={{
            flex: 1,
            fontFamily: typography.getFontFamily('normal'),
            //fontFamily: typography.getFontFamily(value != null ? 'semibold' : 'normal'),
            fontSize: typography.fontSize.subheadline,
            color: value != null ? colors.text : colors.textMuted,
          }}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <SFSymbolIcon name="chevron-down" />
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
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => {
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

// Multi-select Dropdown for Game Type with Modal
interface MultiSelectDropdownProps {
  placeholder: string;
  selectedValues: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  colors: any;
  typography: any;
  touchTargets: any;
  label: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  placeholder,
  selectedValues,
  options,
  onChange,
  colors,
  typography,
  touchTargets,
  label,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const displayText = selectedValues.length > 0
    ? `${selectedValues.length} selected`
    : placeholder;

  const toggleValue = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: 44,
          backgroundColor: colors.card,
          borderColor: selectedValues.length > 0 ? colors.accent : colors.border,
        }}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={`${placeholder}: ${displayText}`}
        accessibilityRole="button"
      >
        <Text
          style={{
            flex: 1,
            fontFamily: typography.getFontFamily('normal'),
            //fontFamily: typography.getFontFamily(selectedValues.length > 0 ? 'semibold' : 'normal'),
            fontSize: typography.fontSize.subheadline,
            color: selectedValues.length > 0 ? colors.text : colors.textMuted,
          }}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <SFSymbolIcon name="chevron-down" />
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
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedValues.includes(item.value);
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
                    onPress={() => toggleValue(item.value)}
                    onPressIn={() => setHoveredOption(item.value)}
                    onPressOut={() => setHoveredOption(null)}
                    accessibilityLabel={item.label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    activeOpacity={0.6}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        marginRight: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderColor: isSelected ? colors.accent : (isHovered ? colors.accent : colors.textMuted),
                        backgroundColor: isSelected ? colors.accent : (isHovered ? colors.accent : 'transparent'),
                      }}
                    >
                      {isSelected && (
                        <Text style={{ color: colors.card, fontSize: 14, fontWeight: 'bold' }}>✓</Text>
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
                onPress={() => onChange([])}
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

export const FilterGameModal: React.FC<FilterGameModalProps> = ({
  isVisible,
  onClose,
  onApplyFilters,
  title = "Filter Your Collection",
  description = "All filters (optional)",
  applyButtonText = "Apply Filters",
  initialFilters,
  onFiltersChange,
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const { screenHeight } = useDeviceType();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  // Local draft state for range-based filters
  const [draftFilters, setDraftFilters] = useState<FilterState>(initialFilters || {
    gameType: []
  });

  // Validation state for range errors
  const [rangeErrors, setRangeErrors] = useState<{
    playerCount?: string;
    playTime?: string;
    minAge?: string;
    complexity?: string;
  }>({});

  // Update draft when initialFilters change
  useEffect(() => {
    if (initialFilters) {
      setDraftFilters(initialFilters);
    }
  }, [initialFilters]);

  // Validate a numeric range (min <= max)
  const validateRange = useCallback((min: number | null | undefined, max: number | null | undefined): string | null => {
    if (min != null && max != null && min > max) {
      return `Minimum value cannot be greater than maximum value`;
    }
    return null;
  }, []);

  // Check if any validation errors exist
  const hasValidationErrors = useMemo(() => {
    return Object.values(rangeErrors).some(error => error != null);
  }, [rangeErrors]);

  // Helper to extract min/max for validation (used during validation, not storage)
  const extractForValidation = useCallback((key: keyof FilterState, field: 'min' | 'max', value: number | null | undefined): number | null | undefined => {
    if (value == null) return value;

    // For playTime, use direct values (no longer need to extract from timeOptions)
    if (key === 'playTime') {
      return value;
    }

    // For minAge, look up the option and extract min or max
    if (key === 'minAge') {
      const option = ageOptions.find(opt => opt.value === value);
      if (option) {
        return field === 'min' ? option.min : option.max;
      }
    }

    // For playerCount and complexity, use the value directly
    return value;
  }, []);

  // Helper to update a numeric range filter with validation
  const updateRangeFilter = useCallback((key: keyof FilterState, field: 'min' | 'max', value: number | null) => {
    setDraftFilters(prev => {
      const current = prev[key] as NumericRange || {};

      // Store the option.value directly (not the extracted min/max)
      const updated = { ...current, [field]: value };

      // Single-point range behavior: only for playerCount (not time/age/complexity)
      if (key === 'playerCount' && field === 'min' && value != null && current.max == null) {
        updated.max = value;
      } else if (key === 'playerCount' && field === 'max' && value != null && current.min == null) {
        updated.min = value;
      }

      const newFilters = { ...prev, [key]: updated };

      // Validate using extracted values (for time/age, extract min/max from the stored option.value)
      const minToValidate = extractForValidation(key, 'min', updated.min);
      const maxToValidate = extractForValidation(key, 'max', updated.max);
      const error = validateRange(minToValidate, maxToValidate);
      setRangeErrors(prevErrors => ({
        ...prevErrors,
        [key]: error || undefined
      }));

      return newFilters;
    });
  }, [validateRange, extractForValidation]);

  // Helper to update game type filter
  const updateGameTypeFilter = useCallback((value: FilterState['gameType']) => {
    setDraftFilters(prev => ({ ...prev, gameType: value }));
  }, []);

  // Clear all filters
  const clearAllFilters = () => {
    const clearedState: FilterState = { gameType: [] };
    setDraftFilters(clearedState);
    setRangeErrors({});
    onFiltersChange(clearedState);
    announceForAccessibility('All filters cleared');
  }

  // Handle apply filters
  const handleApplyFilters = () => {
    if (hasValidationErrors) {
      announceForAccessibility('Please fix validation errors before applying filters');
      return;
    }

    // Commit draft filters to parent
    onFiltersChange(draftFilters);
    announceForAccessibility('Filters applied successfully');
    onApplyFilters();
  };

  const styles = useMemo(() => getStyles(colors, typography, screenHeight), [colors, typography, screenHeight]);

  if (!isVisible) return null;

  const content = (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityHint="Closes the filter modal"
          hitSlop={touchTargets.small}
        >
          <SFSymbolIcon name="x" />
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        {description}
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        {/* Player Count */}
        <View style={styles.filterSection}>
          <View style={styles.categoryHeader}>
            <SFSymbolIcon name="users" />
            <Text style={styles.categoryLabel}>Player Count</Text>
          </View>
          <View style={styles.dropdownRow}>
            <FilterDropdown
              //placeholder="Min Players"
              placeholder="Min"
              value={draftFilters.playerCount?.min}
              options={playerOptions}
              onChange={(val) => updateRangeFilter('playerCount', 'min', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Minimum Players"
            />
            <View style={{ width: 16 }} />
            <FilterDropdown
              //placeholder="Max Players"
              placeholder="Max"
              value={draftFilters.playerCount?.max}
              options={playerOptions}
              onChange={(val) => updateRangeFilter('playerCount', 'max', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Maximum Players"
            />
          </View>
          {rangeErrors.playerCount && (
            <Text style={styles.errorText}>{rangeErrors.playerCount}</Text>
          )}
        </View>

        {/* Recommended Age */}
        <View style={styles.filterSection}>
          <View style={styles.categoryHeader}>
            <SFSymbolIcon name="baby" />
            <Text style={styles.categoryLabel}>Recommended Age</Text>
          </View>
          <View style={styles.dropdownRow}>
            <FilterDropdown
              //placeholder="Min Age"
              placeholder="Min"
              value={draftFilters.minAge?.min}
              options={ageOptions}
              onChange={(val) => updateRangeFilter('minAge', 'min', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Minimum Age"
            />
            <View style={{ width: 16 }} />
            <FilterDropdown
              //placeholder="Max Age"
              placeholder="Max"
              value={draftFilters.minAge?.max}
              options={ageOptions}
              onChange={(val) => updateRangeFilter('minAge', 'max', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Maximum Age"
            />
          </View>
          {rangeErrors.minAge && (
            <Text style={styles.errorText}>{rangeErrors.minAge}</Text>
          )}
        </View>

        {/* Complexity */}
        <View style={styles.filterSection}>
          <View style={styles.categoryHeader}>
            <SFSymbolIcon name="brain" />
            <Text style={styles.categoryLabel}>Complexity</Text>
          </View>
          <View style={styles.dropdownRow}>
            <FilterDropdown
              //placeholder="Light"
              placeholder="Min"
              value={draftFilters.complexity?.min}
              options={complexityOptions}
              onChange={(val) => updateRangeFilter('complexity', 'min', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Minimum Complexity"
            />
            <View style={{ width: 16 }} />
            <FilterDropdown
              //placeholder="Heavy"
              placeholder="Max"
              value={draftFilters.complexity?.max}
              options={complexityOptions}
              onChange={(val) => updateRangeFilter('complexity', 'max', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Maximum Complexity"
            />
          </View>
          {rangeErrors.complexity && (
            <Text style={styles.errorText}>{rangeErrors.complexity}</Text>
          )}
        </View>

        {/* Length of Game */}
        <View style={styles.filterSection}>
          <View style={styles.categoryHeader}>
            <SFSymbolIcon name="clock" />
            <Text style={styles.categoryLabel}>Length of Game</Text>
          </View>
          <View style={styles.dropdownRow}>
            <FilterDropdown
              placeholder="Min"
              value={draftFilters.playTime?.min}
              options={minTimeOptions}
              onChange={(val) => updateRangeFilter('playTime', 'min', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Minimum Play Time"
            />
            <View style={{ width: 16 }} />
            <FilterDropdown
              placeholder="Max"
              value={draftFilters.playTime?.max}
              options={maxTimeOptions}
              onChange={(val) => updateRangeFilter('playTime', 'max', val)}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Maximum Play Time"
            />
          </View>
          {rangeErrors.playTime && (
            <Text style={styles.errorText}>{rangeErrors.playTime}</Text>
          )}
        </View>

        {/* Game Type */}
        <View style={styles.filterSection}>
          <View style={styles.categoryHeader}>
            <GamepadIcon size={20} color={colors.text} />
            <Text style={styles.categoryLabel}>Game Type</Text>
          </View>
          <View style={styles.dropdownRow}>
            <MultiSelectDropdown
              placeholder="Select types"
              selectedValues={draftFilters.gameType || []}
              options={typeOptions}
              onChange={(val) => updateGameTypeFilter(val as FilterState['gameType'])}
              colors={colors}
              typography={typography}
              touchTargets={touchTargets}
              label="Game Type"
            />
          </View>
        </View>

        {/* Clear All Button */}
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={clearAllFilters}
          accessibilityLabel="Clear all filters"
          accessibilityHint="Removes all applied filters"
          hitSlop={touchTargets.small}
        >
          <Text style={styles.clearAllButtonText}>Clear All Filters</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.applyButton,
          hasValidationErrors && styles.applyButtonDisabled
        ]}
        onPress={handleApplyFilters}
        disabled={hasValidationErrors}
        accessibilityLabel={hasValidationErrors ? "Fix validation errors to apply filters" : "Apply filters"}
        accessibilityHint={hasValidationErrors ? "Please fix the validation errors shown above" : "Applies the selected filters to the collection"}
        hitSlop={touchTargets.small}
      >
        <Text style={[
          styles.applyButtonText,
          hasValidationErrors && styles.applyButtonTextDisabled
        ]}>
          {applyButtonText}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {content}
        </View>
      </View>
    </Modal>
  );
};

// Keep the legacy filterGames export for backwards compatibility
export const filterGames = (
  games: Game[],
  playerCount: FilterOption[],
  playTime: FilterOption[],
  age: FilterOption[],
  gameType: FilterOption[],
  complexity: FilterOption[]
) => {
  // This is kept for backwards compatibility but should eventually be removed
  return games;
};

const getStyles = (colors: any, typography: any, screenHeight: number) => {
  const responsiveMinHeight = Math.max(450, Math.min(550, screenHeight * 0.65));

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      width: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      minHeight: responsiveMinHeight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 6,
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
    },
    description: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      marginBottom: 8,
      paddingTop: 2,
    },
    scrollView: {
      flex: 1,
      minHeight: 0,
    },
    scrollViewContent: {
      paddingBottom: 4,
      paddingTop: 2,
    },
    filterSection: {
      marginBottom: 20,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    categoryLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
    },
    dropdownRow: {
      flexDirection: 'row',
      gap: 16,
    },
    applyButton: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginBottom: 0,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    applyButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
    },
    clearAllButton: {
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearAllButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
    },
    errorText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.error || '#ff4444',
      marginTop: 8,
      marginLeft: 4,
    },
    applyButtonDisabled: {
      backgroundColor: colors.textMuted || '#cccccc',
      shadowOpacity: 0,
      elevation: 0,
    },
    applyButtonTextDisabled: {
      color: colors.background || '#ffffff',
    },
  });
};