import RazorpayCheckout from 'react-native-razorpay';
import { Alert } from 'react-native';

const useRazorpay = () => {
    const open = (options: any) => {
        return new Promise((resolve, reject) => {
            RazorpayCheckout.open(options)
                .then((data) => {
                    // handle success
                    resolve(data);
                })
                .catch((error) => {
                    // handle failure
                    Alert.alert(`Error: ${error.code}`, error.description);
                    reject(error);
                });
        });
    };

    return { open };
};

export default useRazorpay;