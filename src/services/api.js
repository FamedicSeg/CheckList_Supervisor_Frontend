import axios from "axios";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    timeout: 30000,
    headers: {
        "Content-Type":"application/json",
    },
});

// Interceptor para manejar errores
api.interceptors.response.use(
    response => response,
    error => {
        if(error.response){
            console.error("Error API:", error.response.status, error.response.data)
        } else if(error.request){
            console.error( "No hubo respuesta del servidor");
        } else{
            console.error("Error:", error.message);
        }
        return Promise.reject(error);
    }
);