/**
 * Pantalla 1 · Inicio de sesión (requerimiento funcional 1).
 *
 * La autenticación la resuelve Firebase Authentication con dos proveedores:
 * correo y contraseña, y Google. Esta pantalla no conoce Firebase: pide el
 * acceso al contexto de sesión y al hook de Google, y muestra el resultado.
 *
 * Al autenticarse no se navega desde aquí. El observador `onAuthStateChanged`
 * del AuthContext detecta el cambio y el guardia de rutas redirige. Así hay
 * una sola ruta de entrada a la zona privada.
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/contexto/AuthContext';
import { useGoogleSignIn } from '../src/servicios/googleAuth';
import { validarLogin, hayErrores } from '../src/lib/validaciones';
import CampoTexto from '../src/componentes/CampoTexto';
import Boton from '../src/componentes/Boton';
import { MensajeError } from '../src/componentes/Estados';
import { colores, espacio, radio, sombra } from '../src/tema';

export default function Login() {
  const router = useRouter();
  const { iniciarSesion, configurado } = useAuth();
  const google = useGoogleSignIn();

  const [datos, setDatos] = useState({ email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const enviar = async () => {
    setMensaje(null);

    const encontrados = validarLogin(datos);
    setErrores(encontrados);
    if (hayErrores(encontrados)) return;

    setEnviando(true);
    try {
      await iniciarSesion({ email: datos.email, password: datos.password });
      // La redirección la hace el guardia del layout al cambiar la sesión.
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          <View style={estilos.marca}>
            <View style={estilos.logo}>
              <Ionicons name="car-sport" size={30} color="#FFFFFF" />
            </View>
            <Text style={estilos.titulo}>RENT SMART</Text>
            <Text style={estilos.lema}>Alquiler de vehículos · Rosales Rent A Car</Text>
          </View>

          {!configurado && (
            <View style={estilos.aviso}>
              <Ionicons name="warning-outline" size={18} color={colores.advertencia} />
              <Text style={estilos.avisoTexto}>
                Firebase no está configurado. Copia .env.example como .env y completa las
                variables EXPO_PUBLIC_FIREBASE_*.
              </Text>
            </View>
          )}

          <View style={estilos.tarjeta}>
            <Text style={estilos.encabezado}>Iniciar sesión</Text>
            <Text style={estilos.subencabezado}>
              Ingresa con tu cuenta registrada en el sistema.
            </Text>

            <MensajeError texto={mensaje || google.error} />

            <CampoTexto
              etiqueta="Correo electrónico"
              valor={datos.email}
              onChangeText={cambiar('email')}
              error={errores.email}
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <CampoTexto
              etiqueta="Contraseña"
              valor={datos.password}
              onChangeText={cambiar('password')}
              error={errores.password}
              placeholder="••••••••"
              secreto
              autoCapitalize="none"
              textContentType="password"
              onSubmitEditing={enviar}
              returnKeyType="go"
            />

            <Boton
              titulo="Entrar"
              onPress={enviar}
              cargando={enviando}
              deshabilitado={!configurado}
            />

            {google.disponible && (
              <>
                <View style={estilos.separador}>
                  <View style={estilos.linea} />
                  <Text style={estilos.separadorTexto}>o</Text>
                  <View style={estilos.linea} />
                </View>

                <Boton
                  titulo="Continuar con Google"
                  variante="secundario"
                  onPress={google.entrarConGoogle}
                  cargando={google.entrando}
                  icono={<Ionicons name="logo-google" size={18} color={colores.primario} />}
                />
              </>
            )}

            <Pressable
              onPress={() => router.push('/recuperar')}
              style={estilos.enlaceCentro}
              accessibilityRole="link"
            >
              <Text style={estilos.enlace}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>

          <View style={estilos.registro}>
            <Text style={estilos.registroTexto}>¿No tienes cuenta?</Text>
            <Pressable onPress={() => router.push('/registro')} accessibilityRole="link">
              <Text style={[estilos.enlace, { fontWeight: '600' }]}>Regístrate aquí</Text>
            </Pressable>
          </View>

          <View style={estilos.pie}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colores.textoTenue} />
            <Text style={estilos.pieTexto}>
              Las contraseñas las gestiona Firebase Authentication. La aplicación nunca
              las almacena ni las transmite a un servidor propio.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.xl, paddingBottom: espacio.xxl },
  marca: { alignItems: 'center', marginTop: espacio.xl, marginBottom: espacio.xl },
  logo: {
    width: 64, height: 64, borderRadius: radio.lg,
    backgroundColor: colores.primario,
    alignItems: 'center', justifyContent: 'center', marginBottom: espacio.md,
  },
  titulo: { fontSize: 24, fontWeight: '800', color: colores.texto, letterSpacing: 1 },
  lema: { fontSize: 13, color: colores.textoSuave, marginTop: espacio.xs },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm,
    backgroundColor: colores.advertenciaSuave,
    borderWidth: 1, borderColor: '#FDE68A', borderRadius: radio.md,
    padding: espacio.md, marginBottom: espacio.lg,
  },
  avisoTexto: { flex: 1, fontSize: 12, color: colores.advertencia, lineHeight: 17 },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderWidth: 1, borderColor: colores.borde, borderRadius: radio.lg,
    padding: espacio.xl, ...sombra,
  },
  encabezado: { fontSize: 20, fontWeight: '700', color: colores.texto },
  subencabezado: { fontSize: 13, color: colores.textoSuave, marginTop: 4, marginBottom: espacio.xl },
  separador: {
    flexDirection: 'row', alignItems: 'center',
    gap: espacio.md, marginVertical: espacio.lg,
  },
  linea: { flex: 1, height: 1, backgroundColor: colores.borde },
  separadorTexto: { fontSize: 12, color: colores.textoTenue },
  enlaceCentro: { alignItems: 'center', marginTop: espacio.lg },
  enlace: { fontSize: 13, color: colores.primario },
  registro: {
    flexDirection: 'row', justifyContent: 'center',
    gap: espacio.xs + 2, marginTop: espacio.xl,
  },
  registroTexto: { fontSize: 13, color: colores.textoSuave },
  pie: {
    flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm,
    marginTop: espacio.xxl, paddingHorizontal: espacio.sm,
  },
  pieTexto: { flex: 1, fontSize: 11, color: colores.textoTenue, lineHeight: 16 },
});
