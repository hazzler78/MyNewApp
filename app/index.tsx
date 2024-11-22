import { ClassicFly } from './components/ClassicFly';
import { 
  Text, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Animated, 
  Platform, 
  Image, 
  TextInput, 
  ScrollView, 
  Button, 
  TouchableWithoutFeedback, 
  Vibration 
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { FlyVariant } from './types';
import { NZGame } from './components/NZGame';
import { WingFighter } from './components/WingFighter';

// Add this type near your other types
interface Splat {
  id: string;
  position: { top: number; left: number };
  timestamp: number;
}

// Create the main component
export default function App() {
  // Move all hooks inside the component
  const [flies, setFlies] = useState<Array<{
    id: string;
    position: { top: number; left: number };
    variant: FlyVariant;
  }>>([]);
  const [score, setScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameMode, setGameMode] = useState<'classic' | 'nz' | 'wingfighter' | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);  // 60 second games
  const [splats, setSplats] = useState<Splat[]>([]);

  const generateNewFlyPosition = useCallback(() => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    return {
      top: Math.random() * (screenHeight - 100),
      left: Math.random() * (screenWidth - 100)
    };
  }, []);

  useEffect(() => {
    if (gameStatus === 'playing') {
      const initialFlies = Array.from({ length: 3 }, (_, index) => ({
        id: `fly-${index}`,
        position: generateNewFlyPosition(),
        variant: 'normal' as FlyVariant
      }));
      setFlies(initialFlies);
    }
  }, [gameStatus, generateNewFlyPosition]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const moveInterval = setInterval(() => {
      setFlies(prevFlies => prevFlies.map(fly => {
        const newLeft = fly.position.left + (Math.random() * 6 - 3);
        const newTop = fly.position.top + (Math.random() * 6 - 3);
        
        // Keep flies within bounds
        const boundedLeft = Math.max(0, Math.min(newLeft, Dimensions.get('window').width - 50));
        const boundedTop = Math.max(0, Math.min(newTop, Dimensions.get('window').height - 50));
        
        return {
          ...fly,
          position: {
            left: boundedLeft,
            top: boundedTop
          }
        };
      }));
    }, 50);  // Update every 50ms for smooth movement
    
    return () => clearInterval(moveInterval);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const spawnInterval = setInterval(() => {
      setFlies(prevFlies => {
        if (prevFlies.length < 5) {  // Maximum 5 flies at once
          return [...prevFlies, {
            id: `fly-${Date.now()}`,
            position: generateNewFlyPosition(),
            variant: Math.random() > 0.8 ? 'bonus' : 'normal' as FlyVariant  // 20% chance for bonus fly
          }];
        }
        return prevFlies;
      });
    }, 2000);  // Spawn new fly every 2 seconds if below max
    
    return () => clearInterval(spawnInterval);
  }, [isPlaying, generateNewFlyPosition]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsPlaying(false);
          setGameStatus('gameover');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleFlyPress = useCallback((
    id: string, 
    position: { top: number; left: number }, 
    variant: FlyVariant
  ) => {
    setFlies(prevFlies => prevFlies.filter(fly => fly.id !== id));
    setScore(prevScore => prevScore + (variant === 'bonus' ? 3 : 1));
    
    // Add splat
    setSplats(prev => [...prev, {
      id: `splat-${Date.now()}`,
      position,
      timestamp: Date.now()
    }]);
    
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
  }, []);

  const startGame = useCallback(() => {
    setGameStatus('playing');
    setScore(0);
    setIsPlaying(true);
  }, []);

  // Add this effect to remove splats after animation
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setSplats(prev => prev.filter(splat => now - splat.timestamp < 1000));
    }, 100);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Return the JSX
  return (
    <View style={styles.container}>
      {gameStatus === 'idle' && (
        <View style={styles.menuContainer}>
          <Text style={styles.title}>Select Game Mode</Text>
          <TouchableOpacity 
            style={styles.modeButton} 
            onPress={() => {
              setGameMode('classic');
              startGame();
            }}
          >
            <Text style={styles.modeButtonText}>Classic Mode</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modeButton} 
            onPress={() => {
              setGameMode('nz');
              startGame();
            }}
          >
            <Text style={styles.modeButtonText}>NZ Challenge</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modeButton} 
            onPress={() => {
              setGameMode('wingfighter');
              startGame();
            }}
          >
            <Text style={styles.modeButtonText}>Wing Fighter</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {gameStatus === 'playing' && gameMode === 'classic' && (
        <>
          <View style={styles.gameArea}>
            {/* Render splats */}
            {splats.map(splat => (
              <Image
                key={splat.id}
                source={{ uri: '/splat.png' }}  // Add a splat image to your public folder
                style={[
                  styles.splat,
                  {
                    top: splat.position.top,
                    left: splat.position.left,
                  }
                ]}
              />
            ))}
            
            {/* Render flies */}
            {flies.map(fly => (
              <ClassicFly
                key={fly.id}
                id={fly.id}
                position={fly.position}
                variant={fly.variant}
                onPress={handleFlyPress}
              />
            ))}
          </View>
          <Text style={styles.timerText}>Time: {timeLeft}s</Text>
          <Text style={styles.scoreText}>Score: {score}</Text>
        </>
      )}
      
      {gameStatus === 'playing' && gameMode === 'nz' && (
        <NZGame onGameEnd={() => setGameStatus('idle')} />
      )}
      
      {gameStatus === 'playing' && gameMode === 'wingfighter' && (
        <WingFighter onGameEnd={(finalScore) => {
          setScore(finalScore);
          setGameStatus('gameover');
        }} />
      )}
      
      {gameStatus === 'gameover' && (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverText}>Game Over!</Text>
          <Text style={styles.finalScoreText}>Final Score: {score}</Text>
          <TouchableOpacity 
            style={styles.playAgainButton}
            onPress={() => {
              setGameStatus('idle');
              setTimeLeft(60);
            }}
          >
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Styles at the bottom
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  startButton: {
    padding: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    margin: 20,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scoreText: {
    position: 'absolute',
    top: 20,
    right: 20,
    fontSize: 24,
    fontWeight: 'bold',
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  modeButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: 200,
    alignItems: 'center',
  },
  modeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  timerText: {
    position: 'absolute',
    top: 20,
    left: 20,
    fontSize: 24,
    fontWeight: 'bold',
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  finalScoreText: {
    fontSize: 32,
    color: 'white',
    marginBottom: 40,
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
  },
  playAgainText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  splat: {
    position: 'absolute',
    width: 50,
    height: 50,
    opacity: 0.7,
    transform: [{ scale: 1.2 }],
    zIndex: 1,  // Below the flies
  },
});

