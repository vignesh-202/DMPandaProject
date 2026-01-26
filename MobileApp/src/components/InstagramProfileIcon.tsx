import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Instagram } from 'lucide-react-native';

interface InstagramProfileIconProps {
    size?: number;
    isDark?: boolean;
}

export default function InstagramProfileIcon({ size = 80, isDark = false }: InstagramProfileIconProps) {
    const borderSize = size + 6;
    const innerSize = size;

    return (
        <View style={styles.container}>
            {/* Gradient Border Effect - Using multiple colored borders */}
            <View style={[
                styles.gradientBorder,
                {
                    width: borderSize,
                    height: borderSize,
                    borderRadius: borderSize / 2,
                }
            ]}>
                {/* Inner white/dark circle */}
                <View style={[
                    styles.innerCircle,
                    {
                        width: innerSize,
                        height: innerSize,
                        borderRadius: innerSize / 2,
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    }
                ]}>
                    <Instagram color="#E1306C" size={size * 0.5} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientBorder: {
        backgroundColor: '#E1306C',
        justifyContent: 'center',
        alignItems: 'center',
        // Creating a gradient-like effect with shadow
        shadowColor: '#f09433',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 8,
    },
    innerCircle: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
