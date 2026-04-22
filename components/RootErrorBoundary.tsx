import React from 'react';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { modalSurfacesSnapshotRef } from '@/contexts/ModalSurfaceContext';

type RootErrorBoundaryProps = {
  children: React.ReactNode;
};

type RootErrorBoundaryState = {
  hasError: boolean;
  details: string;
  copied: boolean;
};

export class RootErrorBoundary extends React.Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = {
    hasError: false,
    details: '',
    copied: false,
  };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const payload = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown',
      buildVersion: Constants.nativeBuildVersion ?? 'unknown',
      modalSurfaces: modalSurfacesSnapshotRef.current,
      errorMessage: error.message,
      errorStack: error.stack ?? 'no stack',
      componentStack: errorInfo.componentStack ?? 'no component stack',
    };

    // Single structured payload makes Metro logs easier to compare with copied details.
    console.error('RootErrorBoundary caught an error', payload);

    this.setState({
      hasError: true,
      details: JSON.stringify(payload, null, 2),
      copied: false,
    });
  }

  private handleCopy = async () => {
    await Clipboard.setStringAsync(this.state.details);
    this.setState({ copied: true });
  };

  private handleTryAgain = () => {
    this.setState({
      hasError: false,
      details: '',
      copied: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          Error details are below. You can copy and share them with QA.
        </Text>

        <ScrollView style={styles.detailsContainer} contentContainerStyle={styles.detailsContent}>
          <Text style={styles.details}>{this.state.details}</Text>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={this.handleCopy}>
            <Text style={styles.primaryButtonText}>
              {this.state.copied ? 'Copied' : 'Copy details'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={this.handleTryAgain}>
            <Text style={styles.secondaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 72,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 16,
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailsContent: {
    padding: 12,
  },
  details: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});
