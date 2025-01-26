import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Animated,
  ScrollView,
  TextInput,
  Button,
} from 'react-native';
import * as Progress from 'react-native-progress';
import Svg, {Path, Circle, Line} from 'react-native-svg';
import moment from 'moment';
import database from '@react-native-firebase/database';
import {
  responsiveWidth,
  responsiveHeight,
  responsiveFontSize,
} from 'react-native-responsive-dimensions';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {Dimensions} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const {width} = Dimensions.get('window'); // Mendapatkan lebar layar perangkat

const Stack = createStackNavigator();

// HomeScreen Component
const HomeScreen = ({navigation}) => {
  const [data, setData] = useState({Nutrisi: 0, WaterLevel: 0, pH: 0});
  const [currentTime, setCurrentTime] = useState(moment().format('HH:mm:ss'));
  const [currentDate, setCurrentDate] = useState(
    moment().format('dddd, DD MMMM YYYY'),
  );
  const [alerts, setAlerts] = useState({
    levelAir: false,
    Nutrisi: false,
    pH: false,
  });

  useEffect(() => {
    const subscriber = database()
      .ref('/parameters')
      .on('value', snapshot => {
        const newData = snapshot.val();

        // Validasi data dari Firebase
        const validatedData = {
          Nutrisi: isNaN(newData?.TDS) ? 0 : newData.TDS,
          WaterLevel: isNaN(newData?.WaterLevel) ? 0 : newData.WaterLevel,
          pH: isNaN(newData?.pH) ? 7 : newData.pH, // Default pH adalah 7 (netral)
        };

        setData(validatedData);

        setAlerts({
          levelAir:
            validatedData.WaterLevel < 0 || validatedData.WaterLevel > 20,
          Nutrisi: validatedData.Nutrisi < 0 || validatedData.Nutrisi > 1400,
          pH: validatedData.pH < 0 || validatedData.pH > 14,
        });
      });

    return () => database().ref('/parameters').off('value', subscriber);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(moment().format('HH:mm:ss'));
      setCurrentDate(moment().format('dddd, DD MMMM YYYY'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAlert = type => {
    Alert.alert('Peringatan!', `${type} berada di luar batas aman!`, [
      {text: 'OK', style: 'destructive'},
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {/* Header */}
        <Text style={styles.header}>SISTEM MONITORING HIDRO DFT</Text>
        <Text style={styles.date}>{currentDate.toUpperCase()}</Text>
        <Text style={styles.time}>{currentTime}</Text>

        {/* Kartu Indikator */}
        <View style={styles.cardContainer}>
          <IndicatorCard
            title="Level Air"
            value={data.WaterLevel}
            min={0}
            max={20}
            icon={<WaterIcon />}
            progressColor="#5096FF"
            size={responsiveWidth(18)}
            showAlert={alerts.levelAir}
            onPress={() => handleAlert('Level Air')}
          />
          <IndicatorCard
            title="Kadar Nutrisi"
            value={data.Nutrisi}
            min={0}
            max={1400}
            icon={<NutrisiIcon />}
            progressColor="#2C82C9"
            size={responsiveWidth(18)}
            showAlert={alerts.Nutrisi}
            onPress={() => handleAlert('Kadar Nutrisi')}
          />
          <IndicatorCard
            title="Kadar pH Air"
            value={data.pH}
            min={0}
            max={14}
            icon={<PHIcon />}
            progressColor="#FFCE47"
            size={responsiveWidth(18)}
            showAlert={alerts.pH}
            onPress={() => handleAlert('Kadar pH Air')}
          />
        </View>

        <TouchableOpacity
          style={styles.historiButton}
          onPress={() => navigation.navigate('Histori')}>
          <Text style={styles.historiButtonText}>Lihat Histori</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// HistoriScreen Component

// const { width } = Dimensions.get('window'); // Mendapatkan lebar layar perangkat

const HistoriScreen = () => {
  const [histori, setHistori] = useState([]);
  const [filteredHistori, setFilteredHistori] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isStartDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [isEndDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const historiRef = database().ref('/history');
    const onValueChange = historiRef.on('value', snapshot => {
      const data = snapshot.val();
      if (data) {
        const parsedData = Object.keys(data)
          .filter(key => data[key]?.time) // Pastikan `time` tidak kosong
          .map((key, index) => ({
            nomor: index + 1,
            waktu: data[key]?.time || '1970-01-01 00:00:00', // Fallback waktu default
            tipe: data[key]?.pumpType || 'Tidak tersedia',
            keterangan: data[key]?.description || 'Tidak tersedia',
            nilai: data[key]?.parameterValue || 'Tidak tersedia', // Gunakan `parameterValue` untuk field nilai
          }));
        setHistori(parsedData);
      } else {
        setHistori([]);
      }
    });

    return () => historiRef.off('value', onValueChange);
  }, []);

  const filterByDateRange = () => {
    if (!startDate || !endDate) {
      alert('Silahkan Isi Rentang Tanggal yang Valid !!!');
      return;
    }

    // Konversi tanggal awal dan akhir ke waktu epoch (timestamp)
    const start = new Date(`${startDate}T00:00:00`).getTime(); // Awal hari
    const end = new Date(`${endDate}T23:59:59`).getTime(); // Akhir hari

    // Filter histori berdasarkan rentang waktu
    const filtered = histori.filter(item => {
      // Parsing waktu dari Firebase ke timestamp
      const itemDate = new Date(item.waktu.replace(' ', 'T')).getTime(); // Ganti spasi dengan 'T'
      return itemDate >= start && itemDate <= end;
    });

    setFilteredHistori(filtered);
    setShowTable(true);

    console.log('Filtered Data:', filtered); // Debugging hasil filter
  };

  const handleStartDateConfirm = date => {
    setStartDate(date.toISOString().split('T')[0]);
    setStartDatePickerVisible(false);
  };

  const handleEndDateConfirm = date => {
    setEndDate(date.toISOString().split('T')[0]);
    setEndDatePickerVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Histori</Text>

      <View style={styles.dateInputContainer}>
        <TouchableOpacity
          onPress={() => setStartDatePickerVisible(true)}
          style={styles.dateInputWrapper}>
          <TextInput
            style={styles.dateInput}
            value={startDate || ''}
            placeholder="Masukkan tanggal mulai"
            editable={false}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setEndDatePickerVisible(true)}
          style={styles.dateInputWrapper}>
          <TextInput
            style={styles.dateInput}
            value={endDate || ''}
            placeholder="Masukkan tanggal akhir"
            editable={false}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.filterButton} onPress={filterByDateRange}>
        <Text style={styles.filterButtonText}>Cari</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isStartDatePickerVisible}
        mode="date"
        onConfirm={handleStartDateConfirm}
        onCancel={() => setStartDatePickerVisible(false)}
      />

      <DateTimePickerModal
        isVisible={isEndDatePickerVisible}
        mode="date"
        onConfirm={handleEndDateConfirm}
        onCancel={() => setEndDatePickerVisible(false)}
      />

      {showTable && (
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.tableContainer}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, {flex: 1}]}>
                No
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, {flex: 2}]}>
                Waktu
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, {flex: 2}]}>
                Komponen
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, {flex: 2}]}>
                Nilai
              </Text>
              <Text
                style={[styles.tableCell, styles.tableHeaderCell, {flex: 2}]}>
                Ket
              </Text>
            </View>

            {filteredHistori.length > 0 ? (
              filteredHistori.map((item, index) => (
                <View
                  key={index}
                  style={[styles.tableRow, styles.tableBodyRow]}>
                  <Text style={[styles.tableCell, {flex: 1}]}>
                    {item.nomor}
                  </Text>
                  <Text style={[styles.tableCell, {flex: 2}]}>
                    {item.waktu}
                  </Text>
                  <Text style={[styles.tableCell, {flex: 2}]}>{item.tipe}</Text>
                  <Text style={[styles.tableCell, {flex: 2}]}>
                    {item.nilai}
                  </Text>
                  <Text style={[styles.tableCell, {flex: 2}]}>
                    {item.keterangan}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noData}>
                Tidak ada histori dalam rentang tanggal tersebut
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// App Component
const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Monitoring DFT" component={HomeScreen} />
        <Stack.Screen name="Histori" component={HistoriScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Icon Components
const WaterIcon = () => (
  <Svg
    width={responsiveWidth(22)}
    height={responsiveHeight(12)}
    viewBox="0 0 64 64">
    <Path
      d="M32 2C32 2 10 24 10 40s10 22 22 22 22-10 22-22S32 2 32 2z"
      fill="#5096FF"
    />
    <Circle cx="32" cy="32" r="12" stroke="#000" strokeWidth="2" fill="none" />
  </Svg>
);

const NutrisiIcon = () => (
  <Svg
    width={responsiveWidth(22)}
    height={responsiveHeight(12)}
    viewBox="0 0 64 64">
    <Path
      d="M32 2C32 2 10 24 10 40s10 22 22 22 22-10 22-22S32 2 32 2z"
      fill="#2C82C9"
    />
    <Line
      x1="24"
      y1="20"
      x2="40"
      y2="44"
      stroke="#FFF"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </Svg>
);

const PHIcon = () => (
  <Svg
    width={responsiveWidth(22)}
    height={responsiveHeight(12)}
    viewBox="0 0 64 64">
    <Path
      d="M28 4v56a4 4 0 0 0 8 0V4a4 4 0 0 0-8 0z"
      fill="#FFCE47"
      stroke="#000"
      strokeWidth="2"
    />
    <Circle cx="32" cy="48" r="6" fill="none" stroke="#000" strokeWidth="2" />
  </Svg>
);

const IndicatorCard = ({
  title,
  value,
  min,
  max,
  icon,
  progressColor,
  size,
  showAlert,
  onPress,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{title}</Text>
          <Progress.Circle
            size={size}
            progress={(value - min) / (max - min)}
            showsText
            color={progressColor}
            thickness={8}
            formatText={() => `${value}`}  // Menampilkan nilai numerik di dalam circle
          />
          <Text style={styles.rangeText}>{`${min} - ${max}`}</Text>
          {showAlert && (
            <TouchableOpacity style={styles.alertButton} onPress={onPress}>
              <Text style={styles.alertButtonText}>PERINGATAN</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Tetap seperti kode yang Anda bagikan
  container: {
    flex: 1,
    backgroundColor: '#D7D0D9',
  },
  scrollViewContent: {
    alignItems: 'center',
    padding: responsiveHeight(3),
  },
  header: {
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  date: {
    fontSize: responsiveFontSize(1.5),
    color: '#333333',
    marginBottom: 5,
  },
  time: {
    fontSize: responsiveFontSize(2),
    color: '#333333',
    marginBottom: 20,
  },
  cardContainer: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    width: responsiveWidth(80),
    borderRadius: 20,
    padding: 15,
    marginVertical: 10,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 10,
  },
  infoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize(2),
    fontWeight: 'bold',
    marginBottom: 5,
  },
  rangeText: {
    fontSize: responsiveFontSize(1.5),
    color: '#777',
    marginTop: 10,
  },
  alertButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  alertButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: responsiveFontSize(1.5),
  },
  historiButton: {
    backgroundColor: '#5096FF',
    padding: 10,
    borderRadius: 10,
    marginTop: 20,
  },
  historiButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: responsiveFontSize(2),
  },
  noHistori: {
    fontSize: responsiveFontSize(2),
    color: '#000',
    textAlign: 'center',
    marginTop: 20,
  },

  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  dateInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  dateInputWrapper: {
    flex: 1,
    marginHorizontal: 5,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  filterButton: {
    marginHorizontal: 100,
    padding: 10,
    backgroundColor: '#007BFF',
    borderRadius: 5,
    alignItems: 'center',
    bottom: 10,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  tableContainer: {
    flexDirection: 'column',
    marginHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  tableHeaderRow: {
    backgroundColor: '#e0e0e0',
  },
  tableBodyRow: {
    backgroundColor: '#fff',
  },
  tableCell: {
    padding: 10,
    textAlign: 'center',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
  },
  noData: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
    color: '#888',
  },
});

export default App;
