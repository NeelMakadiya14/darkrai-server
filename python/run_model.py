import pickle
import sys
from utils import *
from keras.models import load_model

with open('tokenizer.pickle', 'rb') as f:
    tokenizer = pickle.load(f)

model = load_model('model.h5')
text = sys.argv[1]

preprocessed_text = preprocess(text)
sequence_data = convert_text_to_sequences(preprocessed_text, tokenizer = tokenizer)

content = model.predict(sequence_data)

print(content[0][0], content[0][1])