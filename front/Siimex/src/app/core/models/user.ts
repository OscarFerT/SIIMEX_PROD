// src/app/core/models/user.ts
export interface Usuario {
    id: number;
    nombre: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    email: string;
    telefono?: string;
    celular?: string;
    tipoIdentificacionOficial?: string;
    identificacionOficial?: string;
    calle?: string;
    numeroExterior?: string;
    numeroInterior?: string;
    entreCalle?: string;
    yCalle?: string;
    otraReferencia?: string;
    colonia?: string;
    claveLocalidad?: string;
    localidad?: string;
    claveMunicipio?: string;
    municipioDomicilio?: string;
    claveEntidadFederativa?: string;
    codigoPostal?: string;
    claveAgeb?: string;
    claveRedSocial?: string;
    redSocial?: string;
    curp?: string;
    rfc?: string;
    genero?: string;
    fechaNacimiento?: string;
    nacionalidad?: string;
    paisNacimiento?: string;
    entidadFederativa?: string;
    municipio?: string;
    estadoCivil?: string;
    /** INVESTIGADOR, INNOVADOR o HIBRIDO */
    tipoPerfil?: string;
    /** true si ya completó el formulario de completar registro (tiene PerfilMigracion) */
    tienePerfilMigracion?: boolean;
    /** Visibilidad en módulo investigadoras e investigadores: MINIMA | ESTANDAR | COMPLETA */
    visibilidadPerfil?: string;
    consentimientoDirectorioPublico?: boolean;
    gradoAcademico?: string;
    fotoDocumentoId?: number;
    curriculumDocumentoId?: number;
    ineDocumentoId?: number;
    domicilioDocumentoId?: number;
    cedulaDocumentoId?: number;
    constanciaSniiDocumentoId?: number;
    semblanza?: string;
    registro2Completo?: boolean;
  }
  
