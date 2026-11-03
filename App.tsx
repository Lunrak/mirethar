import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { CombatScreen } from './src/modules/combat';

export default function App() {
	return <CombatScreen />;
}

// export default function App() {
// 	return (
// 		<View style={styles.container}>
// 			<Text style={styles.title}>MIRETHAR</Text>
// 			<Text style={styles.subtitle}>
// 				Landscape listo · Motor de combate pendiente
// 			</Text>
// 			<StatusBar
// 				style="light"
// 				hidden
// 			/>
// 		</View>
// 	);
// }

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1a1a1a',
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		color: '#e0d0a0',
		fontSize: 36,
		fontWeight: 'bold',
		letterSpacing: 6,
	},
	subtitle: {
		color: '#aaaaaa',
		marginTop: 16,
		fontSize: 16,
	},
});
